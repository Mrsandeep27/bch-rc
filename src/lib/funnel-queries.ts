/**
 * Funnel dashboard aggregations. Server-only.
 *
 * CONSISTENCY (see src/lib/analytics-service.ts — the single source of truth):
 *
 *  • Stage 1 "Visited site" is the CANONICAL visitor count from
 *    analytics_sessions (server-side, ad-blocker-proof) — the exact same number
 *    the Dashboard and Analytics pages show. It used to be counted from
 *    funnel_events, which is written client-side and misses ~18% of visitors,
 *    so the funnel disagreed with every other page.
 *
 *  • Stages 2-4 come from funnel_events (the client event stream) because those
 *    behaviours have no server-side record. They are therefore UNDERCOUNTED for
 *    any visitor whose beacon was blocked. `coveragePct` reports exactly how
 *    much of the audience emitted events, so the Visited→Product drop is never
 *    mistaken for pure customer behaviour.
 *
 *  • Stages 5-6 come from the ORDERS ledger (authoritative), as distinct
 *    customers so every stage is a people-count.
 *
 *  • The window is IST-day-aligned via analyticsWindow(). It used to be a
 *    rolling `now() - make_interval(days => N)`, which sliced mid-day and made
 *    even the same metric differ from the other pages.
 */

import { sql } from "drizzle-orm";
import { db } from "@/db";
import { FUNNEL_STAGES } from "@/lib/funnel-events";
import { PAID_STATUSES, VALID_ORDER_STATUSES } from "@/lib/order-status";
import {
  analyticsWindow,
  getTrackedVisitors,
  getVisitors,
  warnIfInsane,
} from "@/lib/analytics-service";
import {
  clampPct,
  detectFunnelAnomalies,
  safePct,
} from "@/lib/analytics-validation";

export type FunnelStageResult = {
  key: string;
  label: string;
  visitors: number;
  /** % of the previous stage that made it here (the step conversion). */
  stepPct: number;
  /** % of the top-of-funnel that reached here (overall conversion). */
  fromTopPct: number;
  /** Visitors lost vs the previous stage. */
  dropped: number;
  /** True when this stage is measured from the client-side event stream. */
  clientTracked: boolean;
};

export type FunnelReport = {
  windowDays: number;
  stages: FunnelStageResult[];
  /** CANONICAL unique visitors (analytics_sessions) — matches every other page. */
  visitors: number;
  /** Visitors that emitted a client-side page_view event. <= visitors. */
  trackedVisitors: number;
  /** trackedVisitors / visitors, as a %. Below ~90% the middle stages undercount. */
  coveragePct: number;
  biggestLeak: { fromLabel: string; toLabel: string; dropped: number; stepPct: number } | null;
  anomalies: string[];
  blockedPincodes: Array<{ pincode: string; checks: number; visitors: number }>;
  paymentFailures: Array<{ reason: string; n: number }>;
  serviceability: { total: number; blocked: number; blockedPct: number };
};

function n(v: unknown): number {
  return Number(v ?? 0) || 0;
}

/** Stages sourced from the client event stream (undercounted when beacons are blocked). */
const CLIENT_TRACKED_KEYS = new Set(["product", "cart", "checkout"]);

export async function getFunnelReport(
  siteIds: string[],
  windowDays: number,
): Promise<FunnelReport> {
  const days = Math.max(1, Math.min(90, Math.floor(windowDays) || 1));
  const win = analyticsWindow(days);
  const startIso = win.start.toISOString();

  const siteFilter = sql`array[${sql.join(
    siteIds.map((s) => sql`${s}`),
    sql`, `,
  )}]::text[]`;

  const validStatusList = sql.join(VALID_ORDER_STATUSES.map((s) => sql`${s}`), sql`, `);
  const paidStatusList = sql.join(PAID_STATUSES.map((s) => sql`${s}`), sql`, `);

  const [visitors, trackedVisitors, stageRows, orderRows] = await Promise.all([
    // Stage 1 — canonical, server-side, identical to Dashboard + Analytics.
    getVisitors(siteIds, win.start),
    // Coverage denominator check — how many of those emitted client events.
    getTrackedVisitors(siteIds, win.start),
    // Stages 2-4 — behavioural, only observable client-side.
    db.execute(sql`
      SELECT
        count(DISTINCT visitor_id) FILTER (WHERE type = 'product_view') AS product,
        count(DISTINCT visitor_id) FILTER (WHERE type = 'add_to_cart') AS cart,
        count(DISTINCT visitor_id) FILTER (WHERE type = 'checkout_started') AS checkout
      FROM funnel_events
      WHERE is_bot = false AND site_id = ANY(${siteFilter})
        AND created_at >= ${startIso}
    `) as unknown as Promise<Array<Record<string, unknown>>>,
    // Stages 5-6 — the orders ledger, as distinct BUYERS (people, not rows).
    db.execute(sql`
      SELECT
        count(DISTINCT customer_id) FILTER (WHERE status IN (${validStatusList})) AS "order",
        count(DISTINCT customer_id) FILTER (WHERE status IN (${paidStatusList})) AS paid
      FROM orders
      WHERE site_id = ANY(${siteFilter})
        AND placed_at >= ${startIso}
    `) as unknown as Promise<Array<Record<string, unknown>>>,
  ]);

  const counts: Record<string, unknown> = {
    visit: visitors,
    ...(stageRows[0] ?? {}),
    ...(orderRows[0] ?? {}),
  };

  let prev = 0;
  const stages: FunnelStageResult[] = FUNNEL_STAGES.map((s, i) => {
    const stageVisitors = n(counts[s.key]);
    // Clamp to 100%: a downstream stage can read higher than the previous one
    // when the two are measured from different sources (buyers from the ledger
    // vs client-tracked visitors). Flagged as an anomaly rather than rendered
    // as an impossible > 100% step.
    const stepPct = i === 0 ? 100 : clampPct(safePct(stageVisitors, prev));
    const dropped = i === 0 ? 0 : Math.max(0, prev - stageVisitors);
    const fromTopPct = clampPct(safePct(stageVisitors, visitors));
    prev = stageVisitors;
    return {
      key: s.key,
      label: s.label,
      visitors: stageVisitors,
      stepPct,
      fromTopPct,
      dropped,
      clientTracked: CLIENT_TRACKED_KEYS.has(s.key),
    };
  });

  const anomalies = detectFunnelAnomalies(
    stages.map((s) => ({ label: s.label, visitors: s.visitors })),
  );

  let biggestLeak: FunnelReport["biggestLeak"] = null;
  for (let i = 1; i < stages.length; i++) {
    if (!biggestLeak || stages[i].dropped > biggestLeak.dropped) {
      biggestLeak = {
        fromLabel: stages[i - 1].label,
        toLabel: stages[i].label,
        dropped: stages[i].dropped,
        stepPct: stages[i].stepPct,
      };
    }
  }

  const [blockedRows, failRows, svcRows] = await Promise.all([
    db.execute(sql`
      SELECT metadata->>'pincode' AS pincode,
             count(*) AS checks,
             count(DISTINCT visitor_id) AS visitors
      FROM funnel_events
      WHERE type = 'serviceability_checked' AND metadata->>'serviceable' = 'false'
        AND is_bot = false AND site_id = ANY(${siteFilter})
        AND created_at >= ${startIso}
      GROUP BY 1 ORDER BY checks DESC LIMIT 15
    `),
    db.execute(sql`
      SELECT coalesce(nullif(metadata->>'reason',''), '(no reason given)') AS reason,
             count(*) AS n
      FROM funnel_events
      WHERE type = 'payment_failed' AND is_bot = false AND site_id = ANY(${siteFilter})
        AND created_at >= ${startIso}
      GROUP BY 1 ORDER BY n DESC LIMIT 10
    `),
    db.execute(sql`
      SELECT count(*) AS total,
             count(*) FILTER (WHERE metadata->>'serviceable' = 'false') AS blocked
      FROM funnel_events
      WHERE type = 'serviceability_checked' AND is_bot = false AND site_id = ANY(${siteFilter})
        AND created_at >= ${startIso}
    `),
  ]);

  const blockedPincodes = (blockedRows as unknown as Array<Record<string, unknown>>).map((r) => ({
    pincode: String(r.pincode ?? "—"),
    checks: n(r.checks),
    visitors: n(r.visitors),
  }));
  const paymentFailures = (failRows as unknown as Array<Record<string, unknown>>).map((r) => ({
    reason: String(r.reason ?? "(no reason given)"),
    n: n(r.n),
  }));
  const svc = (svcRows as unknown as Array<Record<string, unknown>>)[0] ?? {};
  const svcTotal = n(svc.total);
  const svcBlocked = n(svc.blocked);

  warnIfInsane("funnel", {
    visitors,
    trackedVisitors,
    buyers: n(counts["order"]),
    paidBuyers: n(counts["paid"]),
  });

  return {
    windowDays: days,
    stages,
    visitors,
    trackedVisitors,
    coveragePct: clampPct(safePct(trackedVisitors, visitors)),
    biggestLeak,
    anomalies,
    blockedPincodes,
    paymentFailures,
    serviceability: {
      total: svcTotal,
      blocked: svcBlocked,
      blockedPct: svcTotal > 0 ? (svcBlocked / svcTotal) * 100 : 0,
    },
  };
}
