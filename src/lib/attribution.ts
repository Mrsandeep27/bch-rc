/**
 * Order attribution resolver — the "attach to the order" half of UTM tracking.
 *
 * Capture already happens server-side: the edge middleware → /api/track upserts
 * every visitor's first-touch source + UTMs into analytics_sessions (ad-blocker
 * proof, never overwritten on later pageviews). This module reads that data at
 * order-creation time and snapshots it onto the order row, so the admin can ask
 * "which reel/campaign produced PAID orders" — not just clicks.
 *
 * First-touch model: we take the EARLIEST analytics_sessions row for the
 * visitor (their prc_vid). If a buyer first arrived from an Instagram reel and
 * later returned by typing the URL, the reel keeps the credit — which is what
 * you want when judging which content actually creates buyers.
 *
 * Best-effort: any failure resolves to 'direct' and is logged, never thrown —
 * attribution must never block checkout.
 */

import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { analyticsSessions } from "@/db/schema";
import { logError } from "@/lib/logger";

export type OrderAttribution = {
  source: string;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  referrerHost: string | null;
};

const DIRECT: OrderAttribution = {
  source: "direct",
  utmSource: null,
  utmMedium: null,
  utmCampaign: null,
  utmContent: null,
  referrerHost: null,
};

const COLS = {
  source: analyticsSessions.source,
  utmSource: analyticsSessions.utmSource,
  utmMedium: analyticsSessions.utmMedium,
  utmCampaign: analyticsSessions.utmCampaign,
  utmContent: analyticsSessions.utmContent,
  referrerHost: analyticsSessions.referrerHost,
};

function shape(row: {
  source: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  referrerHost: string | null;
}): OrderAttribution {
  return {
    source: row.source ?? "direct",
    utmSource: row.utmSource,
    utmMedium: row.utmMedium,
    utmCampaign: row.utmCampaign,
    utmContent: row.utmContent,
    referrerHost: row.referrerHost,
  };
}

export async function resolveOrderAttribution(input: {
  visitorId?: string | null;
  sessionId?: string | null;
  siteId: string;
}): Promise<OrderAttribution> {
  const { visitorId, sessionId, siteId } = input;
  try {
    // First-touch: earliest session for this visitor on this site.
    if (visitorId) {
      const [first] = await db
        .select(COLS)
        .from(analyticsSessions)
        .where(
          and(
            eq(analyticsSessions.visitorId, visitorId),
            eq(analyticsSessions.siteId, siteId),
          ),
        )
        .orderBy(asc(analyticsSessions.startedAt))
        .limit(1);
      if (first) return shape(first);
    }
    // Fallback: the current session row (visitor cookie missing / no history).
    if (sessionId) {
      const [s] = await db
        .select(COLS)
        .from(analyticsSessions)
        .where(eq(analyticsSessions.id, sessionId))
        .limit(1);
      if (s) return shape(s);
    }
  } catch (err) {
    logError("attribution:resolve", err, { visitorId, sessionId });
  }
  return DIRECT;
}
