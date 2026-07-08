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

import { NextResponse, after, type NextRequest } from "next/server";
import { verifyServiceabilityLive } from "@/lib/serviceability";
import { recordServerFunnelEvent } from "@/lib/funnel-server";
import { rateLimit } from "@/lib/rate-limit";

export async function GET(req: NextRequest) {
  // Each call makes a live Shiprocket serviceability fetch AND writes a funnel
  // event; cap per-IP to stop quota burn + analytics poisoning by a flooder.
  const limited = rateLimit(req, { scope: "serviceability", limit: 30 });
  if (limited) return limited;

  const url = new URL(req.url);
  const pincode = url.searchParams.get("pincode") ?? "";
  const needsCod = (url.searchParams.get("payment") ?? "").toLowerCase() === "cod";
  const result = await verifyServiceabilityLive(pincode, needsCod);

  // Authoritative funnel signal — recorded server-side so it can't be blocked
  // and reflects the REAL answer the customer saw. A spike of serviceable:false
  // for valid pincodes is the early-warning siren for a pickup-config outage.
  // Runs after the response so it never adds latency to the checkout UI.
  after(() =>
    recordServerFunnelEvent(req, "serviceability_checked", {
      pincode,
      needsCod,
      serviceable: result.serviceable,
      codAvailable: result.codAvailable,
      reason: result.reason,
    }),
  );

  return NextResponse.json({ ok: true, ...result });
}
