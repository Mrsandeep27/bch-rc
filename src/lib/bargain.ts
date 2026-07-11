/**
 * Server-only engine for the "Name your price" bargain game.
 *
 * Trust boundary: the client sends only a SKU id and a rupee GUESS. Everything
 * that protects margin lives here —
 *   - the list price is read from the server catalog, never trusted from input;
 *   - the hidden floor (list × (1 − maxOff), jittered per device+sku so there's
 *     no shareable magic number) is computed + stored server-side and NEVER
 *     returned to the client;
 *   - the 3-guess limit + cooldown are enforced on a row locked FOR UPDATE, so
 *     refreshing/replaying can't reset attempts or re-roll the floor;
 *   - a win mints a real single-use, 5-minute coupon inside the SAME
 *     transaction as the WON status flip, so the discount and the game state
 *     can never disagree.
 *
 * The floor NEVER implies a discount above BARGAIN.maxOffPct (the hard wall the
 * owner set): jitter only ever makes the floor HIGHER (less discount), rounding
 * is UP, so realised discount ∈ [~minOff, maxOff].
 */

import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { bargainSessions, coupons } from "@/db/schema";
import { PRODUCTS } from "@/lib/products";
import { BARGAIN } from "@/lib/config";

export type BargainState = "active" | "won" | "lost" | "cooldown" | "expired";
/** Deliberately coarse: two buckets, not a precise hot/warm/cold ladder, so a
 *  clever player can't binary-search the exact floor from the feedback. */
export type BargainHeat = "close" | "low";

export type BargainResult = {
  state: BargainState;
  /** List price the game runs against — safe to show (it's the sticker price). */
  listInr: number;
  attemptsLeft: number;
  /** Vague nudge on a rejected guess (never reveals distance to the floor). */
  heat?: BargainHeat;
  /** On a win: the accepted price, the rupees saved, the coupon. */
  wonPriceInr?: number;
  discountInr?: number;
  couponCode?: string;
  /** Epoch ms the coupon ACTUALLY expires (grace window — grab stays valid til here). */
  expiresAtMs?: number;
  /** Epoch ms the VISIBLE urgency countdown hits zero (shorter than expiresAtMs). */
  uiEndsAtMs?: number;
};

export class BargainError extends Error {}

/** The discount ceiling for a SKU: its data-driven tier, else the dead-stock wall. */
function maxOffPctFor(skuId: string): number {
  return BARGAIN.skuMaxOffPct[skuId] ?? BARGAIN.maxOffPct;
}

/**
 * Deterministic 0..1 hash of a string (FNV-1a). Used to jitter the floor per
 * device+sku so two visitors get different floors and there's no one number to
 * share — while staying stable across a single game's guesses.
 */
function hash01(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  // >>> 0 → unsigned; divide by 2^32 → [0,1)
  return (h >>> 0) / 4294967296;
}

/**
 * The HIDDEN reserve price. Guess ≥ this wins. Jitter moves the *effective*
 * discount inside [minOff, maxOff]; rounding is UP so the realised discount can
 * never exceed the wall. Computed once at game start and stored.
 */
export function computeFloorInr(listInr: number, skuId: string, deviceKey: string): number {
  const maxOff = maxOffPctFor(skuId);
  const minOff = Math.min(BARGAIN.minOffPct, maxOff);
  const band = Math.max(0, maxOff - minOff);
  const jitter = hash01(`${deviceKey}:${skuId}`) * band;
  const effectiveOff = minOff + jitter; // ∈ [minOff, maxOff]
  const raw = listInr * (1 - effectiveOff / 100);
  const round = BARGAIN.roundFloorToInr;
  const floor = Math.ceil(raw / round) * round; // round UP → never more discount
  // Guarantee at least one rounding step of discount so a "win" always saves money.
  return Math.min(floor, listInr - round);
}

/** Grade a guess against the hidden floor. Pure — no floor ever leaves here. */
export function gradeGuess(
  guessInr: number,
  floorInr: number,
  listInr: number,
): { win: true; wonPriceInr: number } | { win: false; heat: BargainHeat } {
  if (guessInr >= floorInr) {
    // Win at their guess, clamped so they never "win" above sticker price.
    return { win: true, wonPriceInr: Math.min(guessInr, listInr) };
  }
  // Two coarse buckets only. A single "you're close" band near the floor keeps
  // it fun without handing out a precise distance to binary-search against.
  const closeness = (floorInr - guessInr) / floorInr; // >0, bigger = further off
  return { win: false, heat: closeness <= 0.08 ? "close" : "low" };
}

/** Resolve a live, purchasable SKU + its server-side list price. */
function resolveSku(skuId: string): { id: string; listInr: number } {
  const sku = PRODUCTS.find((p) => p.id === skuId);
  if (!sku) throw new BargainError("Unknown product");
  if (sku.hidden || sku.comingSoon) throw new BargainError("Product not available");
  // NOTE: uses the code catalog price. Admin price overrides (product_overrides)
  // aren't layered here yet — fine while overrides are rare; revisit if they go live.
  return { id: sku.id, listInr: sku.retailINR };
}

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous 0/O/1/I
function newCouponCode(): string {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  let s = "BG-";
  for (const b of bytes) s += CODE_ALPHABET[b % CODE_ALPHABET.length];
  return s;
}

/** Whether a terminal (WON/LOST) row is still inside its replay cooldown. */
function inCooldown(createdAt: Date, now: number): boolean {
  return now - createdAt.getTime() < BARGAIN.cooldownHours * 3_600_000;
}

/**
 * Run one bargain interaction. Call with no `guessInr` to START/peek a game
 * (returns attempts + list price); call with a guess to play a turn.
 */
export async function runBargainOffer(input: {
  siteId: string;
  deviceKey: string;
  skuId: string;
  guessInr?: number;
}): Promise<BargainResult> {
  const { siteId, deviceKey, skuId } = input;
  const { listInr } = resolveSku(skuId);
  const now = Date.now();
  const nowDate = new Date(now);

  return db.transaction(async (tx) => {
    // Ensure a row exists to lock (fresh floor for a brand-new game), then lock it.
    const freshFloor = computeFloorInr(listInr, skuId, deviceKey);
    await tx
      .insert(bargainSessions)
      .values({ siteId, deviceKey, skuId, listInr, floorInr: freshFloor })
      .onConflictDoNothing({
        target: [bargainSessions.deviceKey, bargainSessions.skuId],
      });

    const [row] = await tx
      .select()
      .from(bargainSessions)
      .where(and(eq(bargainSessions.deviceKey, deviceKey), eq(bargainSessions.skuId, skuId)))
      .for("update");

    const attemptsLeft = () => Math.max(0, BARGAIN.attempts - row.attemptsUsed);

    // ── Terminal states ──────────────────────────────────────────────────
    if (row.status === "WON") {
      const expMs = row.expiresAt ? row.expiresAt.getTime() : 0;
      if (expMs > now) {
        // Still inside the grace window — idempotently return their live win
        // (refresh / new tab shows the same price + code). The visible countdown
        // resumes from the ORIGINAL win time so it can't be reset by refreshing.
        return {
          state: "won" as const,
          listInr: row.listInr,
          attemptsLeft: 0,
          wonPriceInr: row.wonPriceInr ?? undefined,
          discountInr: row.wonPriceInr != null ? row.listInr - row.wonPriceInr : undefined,
          couponCode: row.couponCode ?? undefined,
          expiresAtMs: expMs,
          uiEndsAtMs: row.updatedAt.getTime() + BARGAIN.lockMinutes * 60_000,
        };
      }
      // Won but the lock lapsed. Offer's gone; wait out the cooldown.
      if (inCooldown(row.createdAt, now)) {
        return { state: "expired" as const, listInr: row.listInr, attemptsLeft: 0 };
      }
      // Cooldown cleared → fall through to reset a brand-new game below.
    } else if (row.status === "LOST") {
      if (inCooldown(row.createdAt, now)) {
        return { state: "cooldown" as const, listInr: row.listInr, attemptsLeft: 0 };
      }
      // else reset below.
    }

    // ── Reset a cooled-down terminal row into a fresh ACTIVE game ─────────
    let floorInr = row.floorInr;
    if (row.status !== "ACTIVE") {
      floorInr = computeFloorInr(listInr, skuId, `${deviceKey}:${now}`);
      await tx
        .update(bargainSessions)
        .set({
          status: "ACTIVE",
          listInr,
          floorInr,
          attemptsUsed: 0,
          wonPriceInr: null,
          couponCode: null,
          expiresAt: null,
          createdAt: nowDate,
          updatedAt: nowDate,
        })
        .where(eq(bargainSessions.id, row.id));
      row.status = "ACTIVE";
      row.attemptsUsed = 0;
      row.listInr = listInr;
    }

    // ── ACTIVE ───────────────────────────────────────────────────────────
    // Peek/start: no guess yet → just hand back the frame the modal renders.
    if (input.guessInr == null || !Number.isFinite(input.guessInr)) {
      return { state: "active" as const, listInr: row.listInr, attemptsLeft: attemptsLeft() };
    }

    // Out of guesses already (shouldn't happen, but never grade past the limit).
    if (row.attemptsUsed >= BARGAIN.attempts) {
      await tx
        .update(bargainSessions)
        .set({ status: "LOST", updatedAt: nowDate })
        .where(eq(bargainSessions.id, row.id));
      return { state: "lost" as const, listInr: row.listInr, attemptsLeft: 0 };
    }

    const guessInr = Math.round(input.guessInr);
    const graded = gradeGuess(guessInr, floorInr, row.listInr);

    if (graded.win) {
      const rawDiscount = row.listInr - graded.wonPriceInr;

      // Trivial win (guessed almost at sticker): don't mint a ₹9 coupon or
      // clutter the table — just tell them they've basically got our best price.
      if (rawDiscount < BARGAIN.minWinSavingInr) {
        const expiresAt = new Date(now + BARGAIN.couponGraceMinutes * 60_000);
        await tx
          .update(bargainSessions)
          .set({ status: "WON", wonPriceInr: row.listInr, couponCode: null, expiresAt, updatedAt: nowDate })
          .where(eq(bargainSessions.id, row.id));
        return {
          state: "won" as const,
          listInr: row.listInr,
          attemptsLeft: attemptsLeft(),
          wonPriceInr: row.listInr,
          discountInr: 0,
          expiresAtMs: expiresAt.getTime(),
          uiEndsAtMs: now + BARGAIN.lockMinutes * 60_000,
        };
      }

      const wonPriceInr = graded.wonPriceInr;
      const discountInr = rawDiscount;
      // REAL coupon lifetime = grace window (covers a slow payment gateway); the
      // 5-minute urgency the buyer sees is uiEndsAtMs, separate on purpose.
      const expiresAt = new Date(now + BARGAIN.couponGraceMinutes * 60_000);

      let couponCode: string | undefined;
      // Mint a single-use coupon BOUND TO THIS EXACT SKU (constraintSkuId) so the
      // discount can only ever be spent on the car it was won on — it cannot move
      // to another product or bypass that product's discount tier. Retry a couple
      // times on the (astronomically rare) code collision.
      for (let i = 0; i < 3 && !couponCode; i++) {
        const code = newCouponCode();
        const ins = await tx
          .insert(coupons)
          .values({
            siteId,
            code,
            type: "FLAT_INR",
            value: discountInr,
            minOrderInr: 0, // the SKU binding is the gate now, not a rupee floor
            maxDiscountInr: discountInr,
            constraintSkuId: skuId,
            usageLimit: 1,
            perCustomerLimit: 1,
            validFrom: nowDate,
            validTo: expiresAt,
            active: true,
          })
          .onConflictDoNothing({ target: [coupons.siteId, coupons.code] })
          .returning({ code: coupons.code });
        if (ins.length > 0) couponCode = ins[0].code;
      }
      if (!couponCode) throw new BargainError("Could not lock your price — try once more");

      await tx
        .update(bargainSessions)
        .set({ status: "WON", wonPriceInr, couponCode, expiresAt, updatedAt: nowDate })
        .where(eq(bargainSessions.id, row.id));

      return {
        state: "won" as const,
        listInr: row.listInr,
        attemptsLeft: attemptsLeft(),
        wonPriceInr,
        discountInr,
        couponCode,
        expiresAtMs: expiresAt.getTime(),
        uiEndsAtMs: now + BARGAIN.lockMinutes * 60_000,
      };
    }

    // Rejected guess → consume an attempt; last miss ends the game.
    const attemptsUsed = row.attemptsUsed + 1;
    const lost = attemptsUsed >= BARGAIN.attempts;
    await tx
      .update(bargainSessions)
      .set({ attemptsUsed, status: lost ? "LOST" : "ACTIVE", updatedAt: nowDate })
      .where(eq(bargainSessions.id, row.id));

    return {
      state: lost ? ("lost" as const) : ("active" as const),
      listInr: row.listInr,
      attemptsLeft: Math.max(0, BARGAIN.attempts - attemptsUsed),
      heat: graded.heat,
    };
  });
}
