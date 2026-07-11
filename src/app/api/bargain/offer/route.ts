/**
 * POST /api/bargain/offer — one turn of the "Name your price" game.
 *
 * Body: { skuId: string, guessInr?: number }
 *   - no guessInr  → START/peek (returns list price + attempts left)
 *   - with guessInr → play a turn (win / warm-cold / lost)
 *
 * The floor is NEVER in the response. Identity is the prc_vid visitor cookie
 * (minting a first-party prc_bg cookie only if prc_vid is somehow absent), so
 * the 3-guess limit + cooldown survive refreshes. All the money logic lives in
 * runBargainOffer; this handler only does auth-lite, rate-limiting and I/O.
 */

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { runBargainOffer, BargainError } from "@/lib/bargain";
import { isBargainEnabled } from "@/lib/config";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { logWarn } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BG_COOKIE = "prc_bg";

const Body = z.object({
  skuId: z.string().min(1).max(80),
  siteId: z.string().min(1).max(40).default("prc"),
  // Guess in whole rupees. Bounded so a wild value can't do anything odd.
  guessInr: z.coerce.number().int().positive().max(10_000_000).optional(),
});

export async function POST(req: NextRequest) {
  if (!isBargainEnabled()) {
    return NextResponse.json({ ok: false, disabled: true });
  }

  // Two limits: a floody per-IP cap, plus a tight per-device cap so one visitor
  // can't brute-force the floor by hammering guesses.
  const limited = rateLimit(req, { scope: "bargain:offer", limit: 40 });
  if (limited) return limited;

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Bad request" }, { status: 400 });
  }
  const parsed = Body.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid input" }, { status: 400 });
  }

  // Device identity — prefer the stable analytics visitor id; fall back to a
  // dedicated bargain cookie so the game still has a per-device key. Never fall
  // back to IP (shared NATs would let one guess-brute-force spill across users).
  let deviceKey = req.cookies.get("prc_vid")?.value ?? req.cookies.get(BG_COOKIE)?.value ?? null;
  let mintCookie: string | null = null;
  if (!deviceKey) {
    deviceKey = crypto.randomUUID();
    mintCookie = deviceKey;
  }

  try {
    const result = await runBargainOffer({
      siteId: parsed.data.siteId,
      deviceKey,
      skuId: parsed.data.skuId,
      guessInr: parsed.data.guessInr,
    });
    const res = NextResponse.json({ ok: true, ...result });
    if (mintCookie) {
      res.cookies.set(BG_COOKIE, mintCookie, {
        maxAge: 60 * 60 * 24 * 365,
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
      });
    }
    return res;
  } catch (err) {
    if (err instanceof BargainError) {
      return NextResponse.json({ ok: false, error: err.message });
    }
    logWarn("bargain:offer", "unexpected error", {
      ip: clientIp(req),
      msg: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ ok: false, error: "Something went wrong" }, { status: 500 });
  }
}
