/**
 * ANALYTICS SERVICE — the single source of truth for every audience metric.
 *
 * Every admin page (Dashboard, Analytics, Funnel) MUST read its numbers from
 * here. Before this file existed, each page rolled its own SQL and the three
 * disagreed with each other:
 *
 *   Dashboard "Visitors 7d"    3,510   DISTINCT visitor_id, analytics_sessions, IST window
 *   Analytics "Total"          3,510   (same)
 *   Funnel    "Visited site"   2,900   DISTINCT visitor_id, funnel_events, ROLLING now()-7d
 *
 * ── THE TWO TABLES ARE NOT INTERCHANGEABLE ─────────────────────────────────
 *
 *   analytics_sessions  written SERVER-SIDE by the edge middleware (/api/track),
 *                       once per session. Ad-blocker-proof. The record of truth
 *                       for "did a person visit".
 *
 *   funnel_events       written CLIENT-SIDE by the batched browser beacon.
 *                       Ad-blockable, and lost when a visitor bounces before the
 *                       batch flushes. Measured coverage: ~82% of visitors.
 *
 * A visitor therefore ALWAYS exists in analytics_sessions and only *sometimes*
 * in funnel_events. Never count "visitors" from funnel_events — that is what
 * made the funnel disagree with the dashboard by ~17%.
 *
 * ── CANONICAL DEFINITIONS (do not mix them) ────────────────────────────────
 *
 *   VISITOR   one unique person/browser   COUNT(DISTINCT visitor_id)  analytics_sessions
 *   SESSION   one browsing session        COUNT(*)                    analytics_sessions
 *   PAGEVIEW  one page load               SUM(pageview_count)         analytics_sessions
 *   TRACKED   visitor who emitted client  COUNT(DISTINCT visitor_id)  funnel_events
 *   VISITOR   events (funnel steps only)  WHERE type='page_view'
 *   ORDER     one order row               COUNT(*)                    orders (PAID_STATUSES)
 *   BUYER     one distinct customer       COUNT(DISTINCT customer_id) orders
 *   CONVERSION  orders ÷ visitors
 *
 * Bots (is_bot) are excluded from every audience metric.
 *
 * ── ONE WINDOW ─────────────────────────────────────────────────────────────
 * analyticsWindow(days) is IST-day-aligned and INCLUSIVE of today, so `days`
 * buckets are returned. Every page must build its window from it. The funnel
 * previously used a rolling `now() - make_interval(days => N)`, which sliced
 * mid-day and disagreed with the other two pages even for the same metric.
 */

import { sql } from "drizzle-orm";
import { db } from "@/db";
import { PAID_STATUSES, VALID_ORDER_STATUSES } from "@/lib/order-status";
import { addUtcDays, istDayStart } from "@/lib/tz";
import { safePct } from "@/lib/analytics-validation";

const num = (v: unknown): number => Number(v ?? 0) || 0;

export const MAX_WINDOW_DAYS = 365;

export type MetricWindow = {
  /** Length of the window in whole IST days, inclusive of today. */
  days: number;
  /** First instant of the window (IST midnight, `days-1` days ago). */
  start: Date;
  /** First instant of the immediately-preceding equal-length window. */
  prevStart: Date;
};

/**
 * The ONLY way to build an analytics date window. IST day-aligned (India has no
 * DST, so a fixed +5:30 offset is exact) and inclusive of today.
 *   analyticsWindow(7).start === IST midnight, 6 days ago  → 7 buckets
 */
export function analyticsWindow(days: number, now?: Date): MetricWindow {
  const d = Math.max(1, Math.min(MAX_WINDOW_DAYS, Math.floor(days) || 1));
  const today = istDayStart(now);
  const start = addUtcDays(today, -(d - 1));
  return { days: d, start, prevStart: addUtcDays(start, -d) };
}

/** `site_id = ANY(...)`. An empty list matches nothing → all-zero metrics. */
function siteArray(siteIds: string[]) {
  return sql`array[${sql.join(
    siteIds.map((s) => sql`${s}`),
    sql`, `,
  )}]::text[]`;
}

/** Optional upper bound, so a "previous period" can be [prevStart, start). */
function upper(column: string, to?: Date) {
  return to ? sql` AND ${sql.raw(column)} < ${to.toISOString()}` : sql``;
}

async function rows(q: ReturnType<typeof sql>): Promise<Record<string, unknown>[]> {
  return (await db.execute(q)) as unknown as Record<string, unknown>[];
}

// ── Audience ───────────────────────────────────────────────────────────────

export type Audience = {
  /** VISITOR — unique people. The number every page labels "Visitors". */
  visitors: number;
  /** SESSION — visits. Always >= visitors. */
  sessions: number;
  /** PAGEVIEW — page loads. Always >= sessions. */
  pageviews: number;
  /** Unique visitors since IST midnight today. */
  visitorsToday: number;
  /** Unique visitors seen within the live window. */
  liveVisitors: number;
};

const EMPTY_AUDIENCE: Audience = {
  visitors: 0,
  sessions: 0,
  pageviews: 0,
  visitorsToday: 0,
  liveVisitors: 0,
};

/**
 * Every session-derived audience metric in ONE round-trip. `todayStart` and
 * `liveSince` are optional extras the dashboard needs; omit them and those
 * fields mirror the main window.
 */
export async function getAudience(
  siteIds: string[],
  opts: { from: Date; to?: Date; todayStart?: Date; liveSince?: Date },
): Promise<Audience> {
  if (siteIds.length === 0) return EMPTY_AUDIENCE;

  const sites = siteArray(siteIds);
  const from = opts.from.toISOString();
  const to = upper("started_at", opts.to);
  const todayIso = (opts.todayStart ?? opts.from).toISOString();
  const liveIso = (opts.liveSince ?? opts.from).toISOString();

  const [r] = await rows(sql`
    SELECT
      count(DISTINCT visitor_id) FILTER (WHERE is_bot = false AND started_at >= ${from}${to})::int AS visitors,
      count(*)                   FILTER (WHERE is_bot = false AND started_at >= ${from}${to})::int AS sessions,
      coalesce(sum(pageview_count) FILTER (WHERE is_bot = false AND started_at >= ${from}${to}), 0)::int AS pageviews,
      count(DISTINCT visitor_id) FILTER (WHERE is_bot = false AND started_at >= ${todayIso})::int AS visitors_today,
      count(DISTINCT visitor_id) FILTER (WHERE is_bot = false AND last_seen_at >= ${liveIso})::int AS live_visitors
    FROM analytics_sessions
    WHERE site_id = ANY(${sites})
  `);

  return {
    visitors: num(r?.visitors),
    sessions: num(r?.sessions),
    pageviews: num(r?.pageviews),
    visitorsToday: num(r?.visitors_today),
    liveVisitors: num(r?.live_visitors),
  };
}

/** VISITOR — the canonical count. Use this everywhere the word "visitors" appears. */
export async function getVisitors(
  siteIds: string[],
  from: Date,
  to?: Date,
): Promise<number> {
  if (siteIds.length === 0) return 0;
  const [r] = await rows(sql`
    SELECT count(DISTINCT visitor_id)::int AS c
    FROM analytics_sessions
    WHERE site_id = ANY(${siteArray(siteIds)})
      AND is_bot = false
      AND started_at >= ${from.toISOString()}${upper("started_at", to)}
  `);
  return num(r?.c);
}

/** SESSION — visits, not people. */
export async function getSessions(
  siteIds: string[],
  from: Date,
  to?: Date,
): Promise<number> {
  if (siteIds.length === 0) return 0;
  const [r] = await rows(sql`
    SELECT count(*)::int AS c
    FROM analytics_sessions
    WHERE site_id = ANY(${siteArray(siteIds)})
      AND is_bot = false
      AND started_at >= ${from.toISOString()}${upper("started_at", to)}
  `);
  return num(r?.c);
}

/**
 * Visitors in the window who were ALSO seen before it. `new = visitors - returning`.
 */
export async function getReturningVisitors(
  siteIds: string[],
  from: Date,
): Promise<number> {
  if (siteIds.length === 0) return 0;
  const sites = siteArray(siteIds);
  const iso = from.toISOString();
  const [r] = await rows(sql`
    SELECT count(DISTINCT a.visitor_id)::int AS c
    FROM analytics_sessions a
    WHERE a.site_id = ANY(${sites}) AND a.is_bot = false AND a.started_at >= ${iso}
      AND EXISTS (
        SELECT 1 FROM analytics_sessions b
        WHERE b.visitor_id = a.visitor_id
          AND b.site_id = ANY(${sites}) AND b.is_bot = false
          AND b.started_at < ${iso}
      )
  `);
  return num(r?.c);
}

/**
 * TRACKED VISITORS — visitors who emitted a client-side `page_view` event.
 * ONLY for computing funnel-event coverage. Never label this "visitors".
 */
export async function getTrackedVisitors(
  siteIds: string[],
  from: Date,
  to?: Date,
): Promise<number> {
  if (siteIds.length === 0) return 0;
  const [r] = await rows(sql`
    SELECT count(DISTINCT visitor_id)::int AS c
    FROM funnel_events
    WHERE site_id = ANY(${siteArray(siteIds)})
      AND is_bot = false AND type = 'page_view'
      AND created_at >= ${from.toISOString()}${upper("created_at", to)}
  `);
  return num(r?.c);
}

// ── Commerce ───────────────────────────────────────────────────────────────

export type OrderMetrics = {
  /** ORDER — order rows with a paid status. */
  orders: number;
  /** Revenue of those paid orders, in INR. */
  revenue: number;
  /** BUYER — distinct customers with a real (non-failed) order. */
  buyers: number;
  /** BUYER — distinct customers with a paid order. Always <= buyers. */
  paidBuyers: number;
};

const EMPTY_ORDERS: OrderMetrics = { orders: 0, revenue: 0, buyers: 0, paidBuyers: 0 };

export async function getOrderMetrics(
  siteIds: string[],
  from: Date,
  to?: Date,
): Promise<OrderMetrics> {
  if (siteIds.length === 0) return EMPTY_ORDERS;

  const paid = sql.join(PAID_STATUSES.map((s) => sql`${s}`), sql`, `);
  const valid = sql.join(VALID_ORDER_STATUSES.map((s) => sql`${s}`), sql`, `);

  const [r] = await rows(sql`
    SELECT
      count(*) FILTER (WHERE status IN (${paid}))::int AS orders,
      coalesce(sum(total_inr) FILTER (WHERE status IN (${paid})), 0)::int AS revenue,
      count(DISTINCT customer_id) FILTER (WHERE status IN (${valid}))::int AS buyers,
      count(DISTINCT customer_id) FILTER (WHERE status IN (${paid}))::int AS paid_buyers
    FROM orders
    WHERE site_id = ANY(${siteArray(siteIds)})
      AND placed_at >= ${from.toISOString()}${upper("placed_at", to)}
  `);

  return {
    orders: num(r?.orders),
    revenue: num(r?.revenue),
    buyers: num(r?.buyers),
    paidBuyers: num(r?.paid_buyers),
  };
}

/** CONVERSION — paid orders ÷ unique visitors, as a percentage. */
export function getConversion(orders: number, visitors: number): number {
  return safePct(orders, visitors);
}

/** Average order value, guarded against a zero denominator. */
export function getAov(revenue: number, orders: number): number {
  return orders > 0 ? Math.round(revenue / orders) : 0;
}

// ── Phase 8: sanity validation ─────────────────────────────────────────────

export type SanityInput = {
  visitors?: number;
  sessions?: number;
  pageviews?: number;
  trackedVisitors?: number;
  orders?: number;
  buyers?: number;
  paidBuyers?: number;
};

/**
 * Impossible-state detector. These invariants hold by definition; a violation
 * means a query regressed (wrong table, wrong window, or a units mix-up).
 * Returns human-readable warnings — empty when healthy.
 */
export function checkMetricSanity(m: SanityInput): string[] {
  const w: string[] = [];
  const has = (x?: number): x is number => typeof x === "number";

  if (has(m.visitors) && has(m.sessions) && m.visitors > m.sessions)
    w.push(`visitors (${m.visitors}) > sessions (${m.sessions}) — a person cannot have fewer visits than themselves.`);

  if (has(m.sessions) && has(m.pageviews) && m.sessions > m.pageviews)
    w.push(`sessions (${m.sessions}) > pageviews (${m.pageviews}) — every session has >= 1 pageview.`);

  if (has(m.trackedVisitors) && has(m.visitors) && m.trackedVisitors > m.visitors)
    w.push(`tracked visitors (${m.trackedVisitors}) > visitors (${m.visitors}) — client events cannot exceed server sessions.`);

  if (has(m.paidBuyers) && has(m.buyers) && m.paidBuyers > m.buyers)
    w.push(`paid buyers (${m.paidBuyers}) > buyers (${m.buyers}) — PAID_STATUSES must be a subset of VALID_ORDER_STATUSES.`);

  if (has(m.paidBuyers) && has(m.orders) && m.paidBuyers > m.orders)
    w.push(`paid buyers (${m.paidBuyers}) > paid orders (${m.orders}) — a buyer places at least one order.`);

  return w;
}

/** Dev-only: shout about impossible states instead of rendering them silently. */
export function warnIfInsane(context: string, m: SanityInput): void {
  if (process.env.NODE_ENV === "production") return;
  for (const msg of checkMetricSanity(m)) {
    console.warn(`[analytics-sanity:${context}] ${msg}`);
  }
}
