/**
 * GET /api/serviceability?pincode=560064&payment=cod
 *
 * Live serviceability + ETA used by the checkout form. Read-only, deterministic
 * (see resolveServiceability). The authoritative gate lives in
 * /api/orders/create — this just lets the UI warn the customer before they fill
 * the whole form / pick COD.
 */

import { NextResponse } from "next/server";
import { resolveServiceability } from "@/lib/serviceability";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const pincode = url.searchParams.get("pincode") ?? "";
  const result = resolveServiceability(pincode);
  return NextResponse.json({ ok: true, ...result });
}
