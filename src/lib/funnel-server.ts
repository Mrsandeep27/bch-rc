/**
 * Server-side funnel-event writer.
 *
 * Both the public batch endpoint (/api/track/event) and server routes that
 * want to record an authoritative event (e.g. /api/serviceability logging
 * every pincode result) go through here. The visitor/session identity is read
 * from the httpOnly prc_sid / prc_vid cookies on the REQUEST — the browser
 * never has to expose them to JS, and a spoofed body can't forge a session.
 *
 * Telemetry must never break a user flow, so every write is best-effort: it
 * swallows and logs failures and returns rather than throwing.
 */

import type { NextRequest } from "next/server";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { funnelEvents, analyticsSessions } from "@/db/schema";
import { SESSION_COOKIE, VISITOR_COOKIE, isBotUA } from "@/lib/analytics";
import { isFunnelEvent, type FunnelEventType } from "@/lib/funnel-events";
import { logError } from "@/lib/logger";

const SITE_ID = process.env.DEFAULT_SITE_ID ?? "prc";

/**
 * Single hub store: every funnel event belongs to the one site. (The old
 * prc16 host/path attribution is gone with the store split — /16 pages that
 * are still reachable attribute here too, which is what the dashboard wants.)
 */
function resolveEventSiteId(_host: string, _path?: string | null): string {
  return SITE_ID;
}

export type FunnelEventInput = {
  type: FunnelEventType | string;
  path?: string | null;
  metadata?: Record<string, unknown> | null;
  orderId?: string | null;
};

type Ids = { sessionId: string | null; visitorId: string | null; isBot: boolean };

function idsFromRequest(req: NextRequest): Ids {
  return {
    sessionId: req.cookies.get(SESSION_COOKIE)?.value ?? null,
    visitorId: req.cookies.get(VISITOR_COOKIE)?.value ?? null,
    isBot: isBotUA(req.headers.get("user-agent")),
  };
}

/** Keep metadata small + JSON-safe; drop anything non-plain. */
function cleanMetadata(m: unknown): Record<string, unknown> {
  if (!m || typeof m !== "object") return {};
  try {
    const json = JSON.stringify(m);
    if (json.length > 4000) return {}; // oversized → drop, never store blobs
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return {};
  }
}

/** Bulk-insert a batch of funnel events for one request's session. */
export async function recordFunnelEvents(
  req: NextRequest,
  items: FunnelEventInput[],
): Promise<void> {
  if (!items.length) return;
  const { sessionId, visitorId, isBot } = idsFromRequest(req);
  const host = req.headers.get("host")?.toLowerCase() ?? "";

  const rows = items
    .filter((e) => isFunnelEvent(String(e.type)))
    .slice(0, 50)
    .map((e) => ({
      siteId: resolveEventSiteId(host, e.path),
      sessionId,
      visitorId,
      type: String(e.type),
      path: e.path ? String(e.path).slice(0, 512) : null,
      metadata: cleanMetadata(e.metadata),
      orderId: e.orderId ? String(e.orderId).slice(0, 64) : null,
      isBot,
    }));

  if (!rows.length) return;
  try {
    await db.insert(funnelEvents).values(rows);
  } catch (err) {
    logError("funnel:record-batch", err, { count: rows.length });
  }

  // Keep the session's liveness fresh straight from this batched beacon,
  // instead of the per-navigation /api/track round-trip the middleware used to
  // fire. This only UPDATEs an existing row (the session was INSERTed
  // server-side on its first hit), so it never creates rows and never touches
  // first-touch attribution — it moves just last_seen_at (the live-visitors
  // gauge) and the pageview tally off the per-navigation critical path. Bots
  // are filtered out of every dashboard, so bumping their rows would be waste.
  if (sessionId && !isBot) {
    const pageviews = rows.filter((r) => r.type === "page_view").length;
    try {
      await db
        .update(analyticsSessions)
        .set({
          lastSeenAt: new Date(),
          pageviewCount: sql`${analyticsSessions.pageviewCount} + ${pageviews}`,
        })
        .where(eq(analyticsSessions.id, sessionId));
    } catch (err) {
      logError("funnel:session-bump", err, { sessionId });
    }
  }
}

/** Record a single event from inside a server route (authoritative source). */
export async function recordServerFunnelEvent(
  req: NextRequest,
  type: FunnelEventType,
  metadata?: Record<string, unknown>,
  opts?: { path?: string | null; orderId?: string | null },
): Promise<void> {
  await recordFunnelEvents(req, [
    { type, metadata: metadata ?? {}, path: opts?.path ?? null, orderId: opts?.orderId ?? null },
  ]);
}
