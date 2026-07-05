/**
 * Funnel dashboard aggregations over `funnel_events`. Server-only.
 *
 * Every metric is a DISTINCT-visitor count so the funnel reads as "of N people,
 * how many reached each step" — the question Syed asked. Bots are excluded.
 */

import { sql } from "drizzle-orm";
import { db } from "@/db";
import { FUNNEL_STAGES } from "@/lib/funnel-events";

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
};

export type FunnelReport = {
  windowDays: number;
  stages: FunnelStageResult[];
  /** The single biggest leak: stage with the largest absolute drop from prev. */
  biggestLeak: { fromLabel: string; toLabel: string; dropped: number; stepPct: number } | null;
  blockedPincodes: Array<{ pincode: string; checks: number; visitors: number }>;
  paymentFailures: Array<{ reason: string; n: number }>;
  serviceability: { total: number; blocked: number; blockedPct: number };
};

function n(v: unknown): number {
  return Number(v ?? 0) || 0;
}

export async function getFunnelReport(
  siteId: string,
  windowDays: number,
): Promise<FunnelReport> {
  const days = Math.max(1, Math.min(90, Math.floor(windowDays)));

  // Top of funnel — distinct-visitor counts from the event stream.
  const stageRows = (await db.execute(sql`
    SELECT
      count(DISTINCT visitor_id) FILTER (WHERE type = 'page_view') AS visit,
      count(DISTINCT visitor_id) FILTER (WHERE type = 'product_view') AS product,
      count(DISTINCT visitor_id) FILTER (WHERE type = 'add_to_cart') AS cart,
      count(DISTINCT visitor_id) FILTER (WHERE type = 'checkout_started') AS checkout
    FROM funnel_events
    WHERE is_bot = false AND site_id = ${siteId}
      AND created_at > now() - make_interval(days => ${days})
  `)) as unknown as Array<Record<string, unknown>>;

  // Bottom of funnel — from the ORDERS TABLE (ground truth). The
  // order_submitted / purchase EVENTS undercount real orders by ~40% (COD,
  // manual, ad-blocked, navigated-away), which made the funnel display a false
  // checkout→order cliff. Orders are the authoritative count.
  const orderRows = (await db.execute(sql`
    SELECT
      count(*) AS "order",
      count(*) FILTER (WHERE status IN ('PAID','PACKED','SHIPPED','DELIVERED')) AS paid
    FROM orders
    WHERE site_id = ${siteId}
      AND placed_at > now() - make_interval(days => ${days})
  `)) as unknown as Array<Record<string, unknown>>;

  const counts = { ...(stageRows[0] ?? {}), ...(orderRows[0] ?? {}) };
  const top = n(counts["visit"]);

  let prev = 0;
  const stages: FunnelStageResult[] = FUNNEL_STAGES.map((s, i) => {
    const visitors = n(counts[s.key]);
    const stepPct = i === 0 ? 100 : prev > 0 ? (visitors / prev) * 100 : 0;
    const dropped = i === 0 ? 0 : Math.max(0, prev - visitors);
    const fromTopPct = top > 0 ? (visitors / top) * 100 : 0;
    prev = visitors;
    return { key: s.key, label: s.label, visitors, stepPct, fromTopPct, dropped };
  });

  // Biggest leak = stage transition with the most visitors lost.
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
        AND is_bot = false AND site_id = ${siteId}
        AND created_at > now() - make_interval(days => ${days})
      GROUP BY 1 ORDER BY checks DESC LIMIT 15
    `),
    db.execute(sql`
      SELECT coalesce(nullif(metadata->>'reason',''), '(no reason given)') AS reason,
             count(*) AS n
      FROM funnel_events
      WHERE type = 'payment_failed' AND is_bot = false AND site_id = ${siteId}
        AND created_at > now() - make_interval(days => ${days})
      GROUP BY 1 ORDER BY n DESC LIMIT 10
    `),
    db.execute(sql`
      SELECT count(*) AS total,
             count(*) FILTER (WHERE metadata->>'serviceable' = 'false') AS blocked
      FROM funnel_events
      WHERE type = 'serviceability_checked' AND is_bot = false AND site_id = ${siteId}
        AND created_at > now() - make_interval(days => ${days})
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

  return {
    windowDays: days,
    stages,
    biggestLeak,
    blockedPincodes,
    paymentFailures,
    serviceability: {
      total: svcTotal,
      blocked: svcBlocked,
      blockedPct: svcTotal > 0 ? (svcBlocked / svcTotal) * 100 : 0,
    },
  };
}
