/**
 * POST /api/track/event — first-party funnel-event ingestion.
 *
 * The browser's funnel tracker (src/lib/funnel-client.ts) batches user actions
 * and flushes them here via fetch(keepalive) / sendBeacon. We read the
 * visitor/session identity from the request cookies (not the body), bot-filter,
 * and bulk-insert. Always 204 — telemetry must never surface an error to the
 * page. No consent gate: this is first-party, no-PII, business-essential data,
 * exactly like /api/track session tracking.
 */

import { NextResponse, type NextRequest } from "next/server";
import { recordFunnelEvents, type FunnelEventInput } from "@/lib/funnel-server";
import { MAX_FUNNEL_BATCH } from "@/lib/funnel-events";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = { events?: FunnelEventInput[] };

export async function POST(req: NextRequest) {
  // Shed floods that would bloat funnel_events. Silent 204 keeps the
  // "never surface an error to the page" telemetry contract. Generous cap so
  // real batched browsing is never throttled.
  const limited = rateLimit(req, { scope: "track:event", limit: 120, silent: true });
  if (limited) return limited;

  let body: Body;
  try {
    // sendBeacon sends as text/plain; parse defensively regardless of header.
    body = JSON.parse(await req.text()) as Body;
  } catch {
    return new NextResponse(null, { status: 204 });
  }

  const events = Array.isArray(body.events) ? body.events.slice(0, MAX_FUNNEL_BATCH) : [];
  if (events.length) await recordFunnelEvents(req, events);

  return new NextResponse(null, { status: 204 });
}
