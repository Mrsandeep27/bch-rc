/**
 * GET /api/serviceability?pincode=560064&payment=cod
 *
 * Live serviceability + ETA used by the checkout form.
 *
 * Calls Shiprocket's serviceability API for the real answer (with the
 * deterministic heuristic as a fallback when Shiprocket is unreachable, so
 * the form never breaks because of a courier-API outage).
 *
 * The hard authoritative gate still lives in /api/orders/create — this route
 * lets the UI warn the customer before they fill the whole form / pick COD.
 */

import { NextResponse } from "next/server";
import { verifyServiceabilityLive } from "@/lib/serviceability";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const pincode = url.searchParams.get("pincode") ?? "";
  const needsCod = (url.searchParams.get("payment") ?? "").toLowerCase() === "cod";
  const result = await verifyServiceabilityLive(pincode, needsCod);
  return NextResponse.json({ ok: true, ...result });
}
