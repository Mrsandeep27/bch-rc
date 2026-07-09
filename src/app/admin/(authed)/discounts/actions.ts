"use server";

/**
 * Discount (coupon) CRUD server actions. Real writes to the `coupons` table,
 * gated by requireAdmin() and scoped to the admin's own sites so one site's
 * admin can never touch another site's coupon.
 *
 * The server is the authoritative validator. The form sends raw string values;
 * everything is parsed + validated here (never trust the client). PERCENT values
 * are stored as percent×100 to stay compatible with lib/coupons.ts, which reads
 * `value` as percent×100 (e.g. 1500 = 15%). Dates from the <input type="date">
 * fields are pinned to IST — start-of-day for validFrom, end-of-day for validTo —
 * so an admin thinking in IST gets the range they expect at checkout.
 */

import { revalidatePath } from "next/cache";
import { and, eq, inArray, isNull, ne, or } from "drizzle-orm";
import { db } from "@/db";
import { coupons } from "@/db/schema";
import { requireAdmin, type AdminContext } from "@/lib/admin-auth";

export type CouponFormInput = {
  code: string;
  type: string;
  /** Human value: rupees for FLAT_INR, whole percent for PERCENT, unused for FREE_SHIPPING. */
  value: string;
  minOrderInr: string;
  maxDiscountInr: string;
  usageLimit: string;
  perCustomerLimit: string;
  /** YYYY-MM-DD or "" (empty validFrom → now). */
  validFrom: string;
  validTo: string;
  active: boolean;
};

export type ActionResult = { ok: boolean; error?: string; id?: string };

type CouponType = "FLAT_INR" | "PERCENT" | "FREE_SHIPPING";
const TYPES: CouponType[] = ["FLAT_INR", "PERCENT", "FREE_SHIPPING"];

type ParsedCoupon = {
  code: string;
  type: CouponType;
  value: number;
  minOrderInr: number;
  maxDiscountInr: number | null;
  usageLimit: number | null;
  perCustomerLimit: number | null;
  validFrom: Date;
  validTo: Date | null;
  active: boolean;
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function istStartOfDay(dateStr: string): Date | null {
  if (!DATE_RE.test(dateStr)) return null;
  const d = new Date(`${dateStr}T00:00:00+05:30`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function istEndOfDay(dateStr: string): Date | null {
  if (!DATE_RE.test(dateStr)) return null;
  const d = new Date(`${dateStr}T23:59:59+05:30`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Parse an optional positive-integer field. Empty → null (no limit). */
function parseOptionalInt(
  raw: string,
  { min }: { min: number },
): { ok: true; value: number | null } | { ok: false } {
  const s = raw.trim();
  if (s === "") return { ok: true, value: null };
  if (!/^\d+$/.test(s)) return { ok: false };
  const n = parseInt(s, 10);
  if (Number.isNaN(n) || n < min) return { ok: false };
  return { ok: true, value: n };
}

/**
 * Authoritative validation + normalisation. Returns the exact DB column values
 * or a user-facing error string. Shared by create + update so the two can never
 * enforce different rules.
 */
function parseAndValidate(
  raw: CouponFormInput,
): { ok: true; data: ParsedCoupon } | { ok: false; error: string } {
  const code = raw.code.trim().toUpperCase();
  if (!code) return { ok: false, error: "Enter a coupon code." };
  if (!/^[A-Z0-9_-]{1,40}$/.test(code)) {
    return {
      ok: false,
      error: "Code can only use letters, numbers, - and _ (max 40 chars).",
    };
  }

  if (!TYPES.includes(raw.type as CouponType)) {
    return { ok: false, error: "Choose a valid discount type." };
  }
  const type = raw.type as CouponType;

  // value — meaning depends on type.
  let value = 0;
  if (type === "FLAT_INR") {
    const s = raw.value.trim();
    if (!/^\d+$/.test(s)) {
      return { ok: false, error: "Discount amount must be a whole number." };
    }
    value = parseInt(s, 10);
    if (value <= 0) {
      return { ok: false, error: "Discount amount must be greater than 0." };
    }
  } else if (type === "PERCENT") {
    const s = raw.value.trim();
    const pct = Number(s);
    if (s === "" || Number.isNaN(pct) || !Number.isInteger(pct)) {
      return { ok: false, error: "Percentage must be a whole number." };
    }
    if (pct < 1 || pct > 100) {
      return { ok: false, error: "Percentage must be between 1 and 100." };
    }
    value = pct * 100; // stored as percent×100 for lib/coupons.ts
  } else {
    // FREE_SHIPPING — no amount; value is unused by the calculator.
    value = 0;
  }

  const minParsed = parseOptionalInt(raw.minOrderInr, { min: 0 });
  if (!minParsed.ok) {
    return { ok: false, error: "Minimum order must be 0 or a positive number." };
  }
  const minOrderInr = minParsed.value ?? 0;

  // maxDiscountInr only applies to PERCENT (a cap on the % discount).
  let maxDiscountInr: number | null = null;
  if (type === "PERCENT") {
    const capParsed = parseOptionalInt(raw.maxDiscountInr, { min: 1 });
    if (!capParsed.ok) {
      return {
        ok: false,
        error: "Max discount cap must be a positive number (or blank).",
      };
    }
    maxDiscountInr = capParsed.value;
  }

  const usageParsed = parseOptionalInt(raw.usageLimit, { min: 1 });
  if (!usageParsed.ok) {
    return {
      ok: false,
      error: "Total usage limit must be at least 1 (or blank for unlimited).",
    };
  }
  const perCustomerParsed = parseOptionalInt(raw.perCustomerLimit, { min: 1 });
  if (!perCustomerParsed.ok) {
    return {
      ok: false,
      error: "Per-customer limit must be at least 1 (or blank for unlimited).",
    };
  }

  // Dates.
  let validFrom: Date;
  if (raw.validFrom.trim() === "") {
    validFrom = new Date();
  } else {
    const parsed = istStartOfDay(raw.validFrom.trim());
    if (!parsed) return { ok: false, error: "Start date is invalid." };
    validFrom = parsed;
  }

  let validTo: Date | null = null;
  if (raw.validTo.trim() !== "") {
    const parsed = istEndOfDay(raw.validTo.trim());
    if (!parsed) return { ok: false, error: "End date is invalid." };
    validTo = parsed;
  }
  if (validTo && validTo.getTime() <= validFrom.getTime()) {
    return { ok: false, error: "End date must be after the start date." };
  }

  return {
    ok: true,
    data: {
      code,
      type,
      value,
      minOrderInr,
      maxDiscountInr,
      usageLimit: usageParsed.value,
      perCustomerLimit: perCustomerParsed.value,
      validFrom,
      validTo,
      active: raw.active === true,
    },
  };
}

/**
 * Is this code already taken in a scope that would collide with `siteId` at
 * checkout? A global coupon (siteId null) overlaps every site; a site coupon
 * overlaps its own site + any global coupon. `excludeId` skips the row being
 * edited.
 */
async function codeConflicts(
  code: string,
  siteId: string | null,
  excludeId?: string,
): Promise<boolean> {
  const scope =
    siteId === null
      ? undefined // global collides with any same-code coupon
      : or(eq(coupons.siteId, siteId), isNull(coupons.siteId));

  const conds = [eq(coupons.code, code)];
  if (scope) conds.push(scope);
  if (excludeId) conds.push(ne(coupons.id, excludeId));

  const rows = await db
    .select({ id: coupons.id })
    .from(coupons)
    .where(and(...conds))
    .limit(1);
  return rows.length > 0;
}

/**
 * Coupons the admin is allowed to manage: their own sites, plus legacy globals
 * (siteId null) — exactly what the list page shows them. An id for another
 * site's coupon simply won't match this WHERE, so the mutation no-ops.
 */
function ownScope(ctx: AdminContext) {
  return ctx.siteIds.length > 0
    ? or(inArray(coupons.siteId, ctx.siteIds), isNull(coupons.siteId))
    : isNull(coupons.siteId);
}

export async function createCoupon(raw: CouponFormInput): Promise<ActionResult> {
  const ctx = await requireAdmin();
  const siteId = ctx.siteIds[0];
  if (!siteId) {
    return { ok: false, error: "Your account has no site assigned." };
  }

  const parsed = parseAndValidate(raw);
  if (!parsed.ok) return { ok: false, error: parsed.error };

  try {
    if (await codeConflicts(parsed.data.code, siteId)) {
      return { ok: false, error: "A coupon with this code already exists." };
    }

    const [row] = await db
      .insert(coupons)
      .values({ siteId, ...parsed.data })
      .returning({ id: coupons.id });

    revalidatePath("/admin/discounts");
    return { ok: true, id: row.id };
  } catch (err) {
    // Unique constraint is the race-safe backstop for the pre-check above.
    if (err instanceof Error && /unique|duplicate/i.test(err.message)) {
      return { ok: false, error: "A coupon with this code already exists." };
    }
    return { ok: false, error: "Could not create the coupon — try again." };
  }
}

export async function updateCoupon(
  id: string,
  raw: CouponFormInput,
): Promise<ActionResult> {
  const ctx = await requireAdmin();
  if (!id) return { ok: false, error: "Missing coupon id." };

  const parsed = parseAndValidate(raw);
  if (!parsed.ok) return { ok: false, error: parsed.error };

  try {
    // Load within the admin's scope; also gives us the row's own siteId so the
    // uniqueness check uses the right collision scope.
    const [existing] = await db
      .select({ id: coupons.id, siteId: coupons.siteId })
      .from(coupons)
      .where(and(eq(coupons.id, id), ownScope(ctx)))
      .limit(1);
    if (!existing) {
      return { ok: false, error: "Coupon not found or not yours to edit." };
    }

    if (await codeConflicts(parsed.data.code, existing.siteId, id)) {
      return { ok: false, error: "Another coupon already uses this code." };
    }

    // siteId is intentionally NOT changed on edit — a coupon can't hop sites.
    await db
      .update(coupons)
      .set(parsed.data)
      .where(and(eq(coupons.id, id), ownScope(ctx)));

    revalidatePath("/admin/discounts");
    return { ok: true, id };
  } catch (err) {
    if (err instanceof Error && /unique|duplicate/i.test(err.message)) {
      return { ok: false, error: "Another coupon already uses this code." };
    }
    return { ok: false, error: "Could not save the coupon — try again." };
  }
}

/** Flip a coupon on/off. Cheapest way to retire a used coupon (never deleted). */
export async function toggleCoupon(
  id: string,
  active: boolean,
): Promise<ActionResult> {
  const ctx = await requireAdmin();
  if (!id) return { ok: false, error: "Missing coupon id." };
  try {
    const res = await db
      .update(coupons)
      .set({ active })
      .where(and(eq(coupons.id, id), ownScope(ctx)))
      .returning({ id: coupons.id });
    if (res.length === 0) {
      return { ok: false, error: "Coupon not found or not yours to edit." };
    }
    revalidatePath("/admin/discounts");
    return { ok: true, id };
  } catch {
    return { ok: false, error: "Could not update the coupon — try again." };
  }
}

/**
 * Delete a coupon. Blocked once it has been redeemed (usedCount > 0): those rows
 * are referenced by the customer_coupon_redemptions ledger, and we never want to
 * lose redemption history. The admin is told to disable instead.
 */
export async function deleteCoupon(id: string): Promise<ActionResult> {
  const ctx = await requireAdmin();
  if (!id) return { ok: false, error: "Missing coupon id." };
  try {
    const [existing] = await db
      .select({ id: coupons.id, usedCount: coupons.usedCount })
      .from(coupons)
      .where(and(eq(coupons.id, id), ownScope(ctx)))
      .limit(1);
    if (!existing) {
      return { ok: false, error: "Coupon not found or not yours to delete." };
    }
    if (existing.usedCount > 0) {
      return {
        ok: false,
        error: "This coupon has been redeemed — disable it instead of deleting.",
      };
    }

    await db.delete(coupons).where(and(eq(coupons.id, id), ownScope(ctx)));
    revalidatePath("/admin/discounts");
    return { ok: true, id };
  } catch {
    return { ok: false, error: "Could not delete the coupon — try again." };
  }
}
