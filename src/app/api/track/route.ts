/**
 * POST /api/track — first-party pageview ingestion.
 *
 * Called SERVER-TO-SERVER by the edge middleware (never by the browser), so
 * ad-blockers can't intercept it. One UPSERT per pageview into
 * analytics_sessions: a new session row on first hit, then last_seen_at +
 * pageview_count bumps for the rest of the 30-min window. First-touch
 * attribution (source/referrer/utm) is set only on insert and never
 * overwritten.
 *
 * This endpoint is best-effort: it must never throw back to the middleware
 * (which is in the critical path of every page load). All failures are logged
 * and swallowed; it always returns 204.
 */

import { NextResponse, type NextRequest } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { sites, analyticsSessions } from "@/db/schema";
import {
  classifySource,
  isBotUA,
  referrerHostOf,
  type TrafficSource,
} from "@/lib/analytics";
import { logError } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TrackBody = {
  sid?: string;
  vid?: string;
  path?: string;
  referrer?: string | null;
  host?: string | null;
  country?: string | null;
  ua?: string | null;
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  utm_term?: string | null;
  utm_content?: string | null;
};

// --- host → site_id resolution, cached (sites change ~never) ------------------
let sitesCache: { at: number; map: Map<string, string> } | null = null;
const SITES_TTL_MS = 10 * 60 * 1000;

async function resolveSiteId(host: string | null | undefined): Promise<string> {
  const fallback = process.env.DEFAULT_SITE_ID ?? "prc";
  const clean = (host ?? "")
    .toLowerCase()
    .replace(/^www\./, "")
    .split(":")[0];
  if (!clean) return fallback;

  if (!sitesCache || Date.now() - sitesCache.at > SITES_TTL_MS) {
    try {
      const rows = await db
        .select({ id: sites.id, domain: sites.domain })
        .from(sites);
      const map = new Map<string, string>();
      for (const r of rows) {
        map.set(r.domain.toLowerCase().replace(/^www\./, ""), r.id);
      }
      sitesCache = { at: Date.now(), map };
    } catch (err) {
      logError("track:resolveSite", err);
      return fallback;
    }
  }
  return sitesCache.map.get(clean) ?? fallback;
}

export async function POST(req: NextRequest) {
  // Optional shared secret — set ANALYTICS_TRACK_SECRET in the env on both the
  // middleware and this route (same Vercel project, same env) to reject
  // spoofed pageviews. If unset, the endpoint accepts (lets tracking work
  // before the secret is provisioned).
  const secret = process.env.ANALYTICS_TRACK_SECRET;
  if (secret && req.headers.get("x-track-secret") !== secret) {
    return new NextResponse(null, { status: 204 });
  }

  let body: TrackBody;
  try {
    body = (await req.json()) as TrackBody;
  } catch {
    return new NextResponse(null, { status: 204 });
  }

  const { sid, vid } = body;
  if (!sid || !vid) return new NextResponse(null, { status: 204 });

  try {
    const ua = body.ua ?? req.headers.get("user-agent");
    const bot = isBotUA(ua);
    const siteId = await resolveSiteId(body.host);
    const refHost = referrerHostOf(body.referrer);
    const source: TrafficSource = classifySource({
      utmMedium: body.utm_medium,
      utmSource: body.utm_source,
      referrerHost: refHost,
      selfHost: body.host,
    });

    await db
      .insert(analyticsSessions)
      .values({
        id: sid,
        visitorId: vid,
        siteId,
        source,
        referrer: body.referrer ?? null,
        referrerHost: refHost,
        landingPath: body.path ?? null,
        utmSource: body.utm_source ?? null,
        utmMedium: body.utm_medium ?? null,
        utmCampaign: body.utm_campaign ?? null,
        utmTerm: body.utm_term ?? null,
        utmContent: body.utm_content ?? null,
        country: body.country ?? null,
        userAgent: ua ?? null,
        isBot: bot,
      })
      .onConflictDoUpdate({
        target: analyticsSessions.id,
        set: {
          lastSeenAt: new Date(),
          pageviewCount: sql`${analyticsSessions.pageviewCount} + 1`,
        },
      });
  } catch (err) {
    logError("track:upsert", err, { sid });
  }

  return new NextResponse(null, { status: 204 });
}
