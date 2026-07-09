import Link from "next/link";
import Image from "next/image";
import {
  AlertTriangle,
  ArrowUpRight,
  Bell,
  CheckCircle2,
  ListChecks,
  PhoneCall,
  Radio,
  Truck,
  type LucideIcon,
} from "lucide-react";
import { and, desc, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { orders } from "@/db/schema";
import { requireAdmin } from "@/lib/admin-auth";
import { getAudience, getConversion, warnIfInsane } from "@/lib/analytics-service";
import { RangeTabs } from "./RangeTabs";
import { QuickRestock } from "./QuickRestock";
import { formatINR } from "@/lib/utils";
import { addUtcDays, istDayStart, istShortDate, istYmd as ymd } from "@/lib/tz";
import { PRODUCTS } from "@/lib/products";
import { LIVE_WINDOW_MINUTES } from "@/lib/analytics";

export const dynamic = "force-dynamic";

// Windows the operator can flip between via the RangeTabs control. Drives every
// period-scoped metric on this page + the sales graph. "Today" and "Live now"
// are real-time and intentionally ignore this.
/** 1 = Today. Keep in sync with RANGES/DEFAULT_RANGE in RangeTabs.tsx. */
const ALLOWED_RANGES = [1, 7, 14, 30] as const;

// SKUs sold below this stock-count threshold appear in the Low-Stock card.
// Tuned to the operator's lead time from Syed (≈48 hrs to top up).
const LOW_STOCK_THRESHOLD = 10;

// Orders we consider "paid" for AOV + top-SKU aggregates. Excludes PENDING
// (UPI carts that never captured) and anything terminal-unhappy.
const PAID_STATUSES = ["PAID", "PACKED", "SHIPPED", "DELIVERED"] as const;

// Notifications stuck this many retries without sending → operator should look.
const STUCK_NOTIF_ATTEMPTS = 3;

type OrderItemForAgg = {
  skuId: string;
  name?: string;
  qty: number;
  lineTotalInr: number;
};

/** One point on the sales chart — an IST hour ("Today") or an IST day. */
type ChartPoint = { label: string; revenue: number; orderCount: number };

// Catalogue lookups for the product widgets (image + display name by SKU id).
const HERO = new Map(PRODUCTS.map((p) => [p.id, p.heroImage]));
const SKU_NAME = new Map(PRODUCTS.map((p) => [p.id, p.name]));

export default async function AdminOverview({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const ctx = await requireAdmin();
  const sp = await searchParams;
  const rangeRaw = Number(sp.range);
  const range: (typeof ALLOWED_RANGES)[number] = (
    ALLOWED_RANGES as readonly number[]
  ).includes(rangeRaw)
    ? (rangeRaw as (typeof ALLOWED_RANGES)[number])
    : 1;

  // Range-aware copy: "last 1 days" reads wrong, so a 1-day window says "today".
  const rangeText = range === 1 ? "today" : `last ${range} days`;

  // Single combined store — every metric aggregates across all sites this admin
  // manages (the per-store toggle was removed).
  const selectedSiteIds = ctx.siteIds;

  const now = new Date();
  // Day boundaries are IST, NOT the server's timezone (UTC on Vercel). Without
  // this, "Today" and the range windows begin at midnight UTC = 5:30 AM IST, so
  // orders placed 00:00–05:30 IST land in the previous day and the numbers
  // disagree with the IST dates shown in the orders list. India has no DST, so a
  // fixed +5:30 offset is exact. Shared IST helpers (src/lib/tz.ts) keep this
  // byte-for-byte identical to the analytics page so the two can't drift.
  const today = istDayStart(now);
  // Period window for the headline scalars (revenue, AOV, units, visitors,
  // conversion, sources, top SKUs) — `range` days INCLUSIVE of today, so the KPI
  // total matches the "Sales over time" graph total exactly (both start at
  // today-(range-1)). Previously started at today-range, which summed one extra
  // day vs the graph and made the deltas compare unequal-length windows.
  const periodStart = addUtcDays(today, -(range - 1));
  // Previous equal-length window immediately before the current one — drives the
  // ▲/▼ deltas on the KPI cards. [prevStart, periodStart), exactly `range` days.
  const prevStart = addUtcDays(today, -(2 * range - 1));
  // Graph window — `range` daily buckets inclusive of today (== periodStart).
  const graphStart = addUtcDays(today, -(range - 1));

  // IMPORTANT: interpolate ISO strings, NOT Date objects, into the sql``
  // templates below. Drizzle's postgres-js driver cannot bind a raw Date inside
  // a sql`` fragment — it throws "The string argument must be of type string".
  // Postgres casts these ISO strings to timestamptz correctly.
  const todayIso = today.toISOString();
  const periodStartIso = periodStart.toISOString();
  const prevStartIso = prevStart.toISOString();
  const graphStartIso = graphStart.toISOString();

  // ── Query 1 of 5: orders scalars ────────────────────────────────
  // One scan of `orders` collects EVERY scalar metric the dashboard needs —
  // today/7d revenue + counts, plus the COD-pending + paid-unshipped tasks
  // counts. Multiple FILTER clauses on one aggregation cost the same as one
  // FILTER on one aggregation in Postgres (single index hit, multiple
  // counters in flight). Was: orderAggP + orderTasksP (2 round-trips).
  const ordersScalarsP = db
    .select({
      todayCount: sql<number>`count(*) filter (where ${orders.placedAt} >= ${todayIso} and ${orders.status} in ('PAID','PACKED','SHIPPED','DELIVERED'))::int`,
      todayRevenue: sql<number>`coalesce(sum(${orders.totalInr}) filter (where ${orders.placedAt} >= ${todayIso} and ${orders.status} in ('PAID','PACKED','SHIPPED','DELIVERED')), 0)::int`,
      weekCount: sql<number>`count(*) filter (where ${orders.placedAt} >= ${periodStartIso} and ${orders.status} in ('PAID','PACKED','SHIPPED','DELIVERED'))::int`,
      weekRevenue: sql<number>`coalesce(sum(${orders.totalInr}) filter (where ${orders.placedAt} >= ${periodStartIso} and ${orders.status} in ('PAID','PACKED','SHIPPED','DELIVERED')), 0)::int`,
      weekPaidCount: sql<number>`count(*) filter (where ${orders.placedAt} >= ${periodStartIso} and ${orders.status} in ('PAID','PACKED','SHIPPED','DELIVERED'))::int`,
      weekPaidRevenue: sql<number>`coalesce(sum(${orders.totalInr}) filter (where ${orders.placedAt} >= ${periodStartIso} and ${orders.status} in ('PAID','PACKED','SHIPPED','DELIVERED')), 0)::int`,
      codPending: sql<number>`count(*) filter (where ${orders.status} = 'PENDING_COD_VERIFICATION')::int`,
      paidUnshipped: sql<number>`count(*) filter (where ${orders.status} = 'PAID' and ${orders.awbCode} is null)::int`,
    })
    .from(orders)
    .where(inArray(orders.siteId, selectedSiteIds));

  // ── Query 2 of 5: every other scalar in one round-trip ──────────
  // CROSS-JOIN of single-row subqueries against several tables. Postgres plans
  // them in parallel and returns a single row of ints. Every subquery is scoped
  // to the selected store(s): customers via their orders (the customers table
  // itself isn't site-scoped), inventory + outbox by site_id, failed shipment
  // jobs by joining orders for the site.
  const siteIdsLiteral = sql`array[${sql.join(
    selectedSiteIds.map((s) => sql`${s}`),
    sql`, `,
  )}]::text[]`;
  const otherScalarsP = db.execute(sql`
    SELECT
      (SELECT count(DISTINCT customer_id)::int FROM orders WHERE site_id = ANY(${siteIdsLiteral}) AND customer_id IS NOT NULL) AS customers_total,
      (SELECT count(*)::int FROM (SELECT customer_id FROM orders WHERE site_id = ANY(${siteIdsLiteral}) AND customer_id IS NOT NULL GROUP BY customer_id HAVING count(*) > 1) t) AS customers_returning,
      (SELECT count(*)::int FROM inventory WHERE site_id = ANY(${siteIdsLiteral}) AND stock < ${LOW_STOCK_THRESHOLD}) AS low_stock,
      (SELECT count(*)::int FROM notifications_outbox WHERE site_id = ANY(${siteIdsLiteral}) AND sent_at IS NULL AND attempts >= ${STUCK_NOTIF_ATTEMPTS}) AS stuck_notifs,
      (SELECT count(*)::int FROM shipment_jobs sj JOIN orders o ON o.id = sj.order_id WHERE sj.status = 'FAILED' AND o.site_id = ANY(${siteIdsLiteral})) AS failed_jobs
  `);

  // ── Query 5 of 5: traffic aggs + sources merged via UNION ALL ───
  // First row is the scalar block (visitorsToday/7d, sessions, live),
  // discriminated by kind='aggs'. Subsequent rows are per-source breakdowns
  // (kind='source'). Single index range scan over analytics_sessions; the
  // grouping cost is the same as the previous two-query version.
  // Was: trafficAggP + trafficSourcesP.
  // Audience scalars come from the ANALYTICS SERVICE (the single source of
  // truth) so Dashboard / Analytics / Funnel can never disagree again. Only the
  // per-source breakdown — which nothing else needs — stays inline here.
  const audienceP = getAudience(selectedSiteIds, {
    from: periodStart,
    todayStart: today,
    liveSince: new Date(now.getTime() - LIVE_WINDOW_MINUTES * 60 * 1000),
  });

  // (The per-source traffic breakdown moved to the Analytics page — a merchant
  // command centre shows what needs doing, not a traffic report.)

  // Sales graph — daily paid revenue, last 14 days. Postgres returns only days
  // that had orders; we pad the gaps below.
  const dailyRevenueP = db
    .select({
      day: sql<string>`to_char(date_trunc('day', ${orders.placedAt} AT TIME ZONE 'Asia/Kolkata'), 'YYYY-MM-DD')`,
      revenue: sql<number>`coalesce(sum(${orders.totalInr}), 0)::int`,
      orderCount: sql<number>`count(*)::int`,
    })
    .from(orders)
    .where(
      and(
        sql`${orders.placedAt} >= ${graphStartIso}`,
        inArray(orders.siteId, selectedSiteIds),
        inArray(orders.status, [...PAID_STATUSES]),
      ),
    )
    .groupBy(sql`date_trunc('day', ${orders.placedAt} AT TIME ZONE 'Asia/Kolkata')`)
    .orderBy(sql`date_trunc('day', ${orders.placedAt} AT TIME ZONE 'Asia/Kolkata')`);

  // (orderTasks, stuckNotifs, failedJobs are now folded into otherScalarsP /
  //  ordersScalarsP above — no separate query needed.)

  const topSkuP = db
    .select({ items: orders.items })
    .from(orders)
    .where(
      and(
        sql`${orders.placedAt} >= ${periodStartIso}`,
        inArray(orders.siteId, selectedSiteIds),
        inArray(orders.status, [...PAID_STATUSES]),
      ),
    )
    .orderBy(desc(orders.placedAt))
    .limit(100);

  const recentP = db
    .select({
      id: orders.id,
      siteId: orders.siteId,
      status: orders.status,
      paymentMethod: orders.paymentMethod,
      totalInr: orders.totalInr,
      placedAt: orders.placedAt,
      shippingAddress: orders.shippingAddress,
    })
    .from(orders)
    .where(inArray(orders.siteId, selectedSiteIds))
    .orderBy(desc(orders.placedAt))
    .limit(40);

  // (The units-sold LATERAL/jsonb_array_elements query was removed with the
  // "Products sold" stat card — top-selling products now carry that story.)

  // Per-promise .catch with safe default so one timed-out query doesn't throw
  // the whole layout into the error boundary. Five queries instead of eleven;
  // see the rewrite at the top of this file (orders scalars, other scalars,
  // daily revenue, top SKU, recent, traffic).
  const [
    ordersScalarsRow,
    otherScalarsRow,
    dailyRevenueRows,
    topSkuOrders,
    recent,
    audience,
  ] = await Promise.all([
    ordersScalarsP.then((r) => r[0] ?? null).catch(() => null),
    otherScalarsP
      .then(
        (r) =>
          (Array.isArray(r) ? r[0] : null) as {
            customers_total: number | null;
            customers_returning: number | null;
            low_stock: number | null;
            stuck_notifs: number | null;
            failed_jobs: number | null;
          } | null,
      )
      .catch(() => null),
    dailyRevenueP.catch(
      () =>
        [] as Array<{ day: string; revenue: number; orderCount: number }>,
    ),
    topSkuP.catch(() => [] as Array<{ items: unknown }>),
    recentP.catch(
      () =>
        [] as Array<{
          id: string;
          siteId: string;
          status: string;
          paymentMethod: string;
          totalInr: number;
          placedAt: Date;
          shippingAddress: unknown;
        }>,
    ),
    audienceP.catch(() => ({
      visitors: 0,
      sessions: 0,
      pageviews: 0,
      visitorsToday: 0,
      liveVisitors: 0,
    })),
  ]);
  // Audience scalars now come straight from the analytics service — the same
  // formula the Analytics page and the Funnel use.
  const trafficAggRow = {
    visitorsToday: audience.visitorsToday,
    visitors7d: audience.visitors,
    sessions7d: audience.sessions,
    live: audience.liveVisitors,
  };
  // Back-compat shims so the rest of the page (already using these names)
  // doesn't need a wholesale rewrite. orderAggRow + orderTasksRow read from
  // ordersScalarsRow; customer/low-stock/stuck/failed read from otherScalarsRow.
  const orderAggRow = ordersScalarsRow;
  const orderTasksRow = ordersScalarsRow
    ? {
        codPending: ordersScalarsRow.codPending,
        paidUnshipped: ordersScalarsRow.paidUnshipped,
      }
    : null;
  const customerAggRow = otherScalarsRow
    ? {
        total: otherScalarsRow.customers_total ?? 0,
        returning: otherScalarsRow.customers_returning ?? 0,
      }
    : null;
  const lowStockAggRow = otherScalarsRow
    ? { count: otherScalarsRow.low_stock ?? 0 }
    : null;
  const stuckNotifsRow = otherScalarsRow
    ? { count: otherScalarsRow.stuck_notifs ?? 0 }
    : null;
  const failedJobsRow = otherScalarsRow
    ? { count: otherScalarsRow.failed_jobs ?? 0 }
    : null;

  const weekStats = {
    orderCount: orderAggRow?.weekCount ?? 0,
    revenue: orderAggRow?.weekRevenue ?? 0,
  };
  const aovStats = {
    orderCount: orderAggRow?.weekPaidCount ?? 0,
    revenue: orderAggRow?.weekPaidRevenue ?? 0,
  };
  const customerStats = { total: customerAggRow?.total ?? 0 };
  const returningStats = {
    returning: customerAggRow?.returning ?? 0,
    total: customerAggRow?.total ?? 0,
  };
  const lowStockCount = lowStockAggRow?.count ?? 0;

  const aov =
    aovStats.orderCount > 0
      ? Math.round(aovStats.revenue / aovStats.orderCount)
      : 0;

  // Visitor metrics + conversion. Orders are written by our own checkout and
  // can't be ad-blocked, so the numerator is exact; VISITORS (not sessions)
  // supply the denominator — see src/lib/analytics-service.ts.
  const visitorsToday = trafficAggRow?.visitorsToday ?? 0;
  const visitors7d = trafficAggRow?.visitors7d ?? 0;
  const sessions7d = trafficAggRow?.sessions7d ?? 0;
  const liveVisitors = trafficAggRow?.live ?? 0;
  // CONVERSION = paid orders ÷ unique VISITORS (people), never ÷ sessions.
  // This page used to divide by sessions while the Analytics page divided by
  // visitors, so the same "Conversion" label showed two different numbers.
  const conversionPct =
    visitors7d > 0 ? Math.round(getConversion(aovStats.orderCount, visitors7d) * 10) / 10 : null;

  warnIfInsane("dashboard", {
    visitors: visitors7d,
    sessions: sessions7d,
    pageviews: audience.pageviews,
  });

  // Previous equal-length window [prevStart, periodStart) — powers the KPI
  // ▲/▼ deltas. Paid orders (same filter as the headline) + bot-filtered
  // sessions, so every delta is real. Best-effort: a failure just hides deltas.
  const prevRow = await db
    .execute(sql`
      SELECT
        (SELECT coalesce(sum(total_inr),0)::int FROM orders
           WHERE site_id = ANY(${siteIdsLiteral})
             AND placed_at >= ${prevStartIso} AND placed_at < ${periodStartIso}
             AND status IN ('PAID','PACKED','SHIPPED','DELIVERED')) AS prev_revenue,
        (SELECT count(*)::int FROM orders
           WHERE site_id = ANY(${siteIdsLiteral})
             AND placed_at >= ${prevStartIso} AND placed_at < ${periodStartIso}
             AND status IN ('PAID','PACKED','SHIPPED','DELIVERED')) AS prev_orders,
        (SELECT count(DISTINCT visitor_id)::int FROM analytics_sessions
           WHERE site_id = ANY(${siteIdsLiteral})
             AND started_at >= ${prevStartIso} AND started_at < ${periodStartIso}
             AND is_bot = false) AS prev_sessions
    `)
    .then(
      (r) =>
        (Array.isArray(r) ? r[0] : null) as {
          prev_revenue: number | null;
          prev_orders: number | null;
          prev_sessions: number | null;
        } | null,
    )
    .catch(() => null);

  // ── Additive dashboard queries ────────────────────────────────────────────
  // NOTHING above was modified: no formula, no window, no analytics logic. These
  // four are NEW because the sections they power (hourly trend, ops cards,
  // low-stock widget, CRM cards) had no data source at all. Each is best-effort
  // so one slow query can't take the page down.
  const [hourlyRows, opsRow, invRows, custRow] = await Promise.all([
    // Hourly revenue — only fetched for the 1-day ("Today") window.
    range === 1
      ? db
          .execute<{ hr: string; revenue: number; orders: number }>(sql`
            SELECT to_char(date_trunc('hour', placed_at AT TIME ZONE 'Asia/Kolkata'), 'HH24') AS hr,
                   coalesce(sum(total_inr), 0)::int AS revenue,
                   count(*)::int AS orders
            FROM orders
            WHERE site_id = ANY(${siteIdsLiteral})
              AND placed_at >= ${todayIso}
              AND status IN ('PAID','PACKED','SHIPPED','DELIVERED')
            GROUP BY 1
          `)
          .then((r) => (Array.isArray(r) ? r : []))
          .catch(() => [])
      : Promise.resolve([] as Array<{ hr: string; revenue: number; orders: number }>),
    db
      .execute<{ failed: number; abandoned: number }>(sql`
        SELECT
          count(*) FILTER (WHERE status = 'FAILED' AND placed_at >= ${periodStartIso})::int AS failed,
          count(*) FILTER (WHERE status = 'ABANDONED' AND placed_at >= ${periodStartIso})::int AS abandoned
        FROM orders WHERE site_id = ANY(${siteIdsLiteral})
      `)
      .then((r) => (Array.isArray(r) ? r[0] : null))
      .catch(() => null),
    // The inventory table is tiny (one row per orderable variant), so a single
    // fetch powers BOTH the low-stock widget and the top-product stock badges.
    db
      .execute<{ sku_id: string; variant_slug: string; stock: number }>(sql`
        SELECT sku_id, variant_slug, stock FROM inventory
        WHERE site_id = ANY(${siteIdsLiteral})
      `)
      .then((r) => (Array.isArray(r) ? r : []))
      .catch(() => []),
    db
      .execute<{ new_customers: number; avg_ltv: number }>(sql`
        SELECT
          (SELECT count(*)::int FROM customers
             WHERE first_site_id = ANY(${siteIdsLiteral}) AND created_at >= ${periodStartIso}) AS new_customers,
          (SELECT coalesce(round(avg(total_spent_inr)), 0)::int FROM customers
             WHERE first_site_id = ANY(${siteIdsLiteral}) AND total_orders >= 1) AS avg_ltv
      `)
      .then((r) => (Array.isArray(r) ? r[0] : null))
      .catch(() => null),
  ]);

  const prevRevenue = prevRow?.prev_revenue ?? 0;
  const prevOrders = prevRow?.prev_orders ?? 0;
  const prevSessions = prevRow?.prev_sessions ?? 0;
  const prevAov = prevOrders > 0 ? Math.round(prevRevenue / prevOrders) : 0;
  const prevConv =
    prevSessions > 0
      ? Math.round((prevOrders / prevSessions) * 1000) / 10
      : null;

  // Pad daily revenue so the graph is continuous.
  const daysMap = new Map(
    dailyRevenueRows.map((r) => [r.day, { revenue: r.revenue, orderCount: r.orderCount }]),
  );
  const dailyBuckets: Array<{ date: Date; revenue: number; orderCount: number }> =
    [];
  for (let i = 0; i < range; i++) {
    const d = new Date(graphStart);
    d.setUTCDate(d.getUTCDate() + i);
    const key = ymd(d);
    const row = daysMap.get(key);
    dailyBuckets.push({
      date: d,
      revenue: row?.revenue ?? 0,
      orderCount: row?.orderCount ?? 0,
    });
  }
  const totalPeriodRevenue = dailyBuckets.reduce((s, b) => s + b.revenue, 0);

  // Chart series — 24 IST hourly buckets for "Today", daily buckets otherwise.
  // A 1-day window used to plot a single point (a giant empty triangle).
  const hourMap = new Map(hourlyRows.map((r) => [r.hr, r]));
  const chartPoints: ChartPoint[] =
    range === 1
      ? Array.from({ length: 24 }, (_, h) => {
          const key = String(h).padStart(2, "0");
          const row = hourMap.get(key);
          return {
            label: `${key}:00`,
            revenue: row?.revenue ?? 0,
            orderCount: row?.orders ?? 0,
          };
        })
      : dailyBuckets.map((b) => ({
          label: istShortDate(b.date),
          revenue: b.revenue,
          orderCount: b.orderCount,
        }));
  const chartMax = Math.max(1, ...chartPoints.map((p) => p.revenue));

  // Orders requiring action.
  const failedPayments = opsRow?.failed ?? 0;
  const abandonedCheckouts = opsRow?.abandoned ?? 0;

  // Inventory — one fetch, two consumers.
  const stockBySku = new Map<string, number>();
  for (const r of invRows)
    stockBySku.set(r.sku_id, (stockBySku.get(r.sku_id) ?? 0) + r.stock);
  const lowStockRows = invRows
    .filter((r) => r.stock < LOW_STOCK_THRESHOLD)
    .sort((a, b) => a.stock - b.stock)
    .slice(0, 5);

  // Customer insights.
  const newCustomers = custRow?.new_customers ?? 0;
  const avgLtv = custRow?.avg_ltv ?? 0;
  const repeatPct =
    customerStats.total > 0
      ? Math.round((returningStats.returning / customerStats.total) * 100)
      : 0;

  // Tasks list.
  const tasks: Array<{
    icon: React.ComponentType<{ size?: number }>;
    label: string;
    count: number;
    href: string;
    tone: "warn" | "bad" | "info";
  }> = [];
  const codPending = orderTasksRow?.codPending ?? 0;
  const paidUnshipped = orderTasksRow?.paidUnshipped ?? 0;
  const stuckNotifs = stuckNotifsRow?.count ?? 0;
  const failedJobs = failedJobsRow?.count ?? 0;
  if (codPending > 0)
    tasks.push({
      icon: PhoneCall,
      label: "COD orders awaiting your call + verify",
      count: codPending,
      href: "/cod",
      tone: "warn",
    });
  if (paidUnshipped > 0)
    tasks.push({
      icon: Truck,
      label: "Paid orders not yet shipped",
      count: paidUnshipped,
      href: "/admin/orders?view=live",
      tone: "warn",
    });
  if (lowStockCount > 0)
    tasks.push({
      icon: AlertTriangle,
      label: `Variants under ${LOW_STOCK_THRESHOLD} units`,
      count: lowStockCount,
      href: "/admin/products",
      tone: "bad",
    });
  if (failedJobs > 0)
    tasks.push({
      icon: Truck,
      label: "Shipment jobs failed — retry needed",
      count: failedJobs,
      href: "/admin/orders?view=live",
      tone: "bad",
    });
  if (stuckNotifs > 0)
    tasks.push({
      icon: Bell,
      label: "Customer emails stuck (3+ retries)",
      count: stuckNotifs,
      href: "/admin/activity",
      tone: "info",
    });

  // Aggregate top SKUs by qty (volume) — restock signal. Tie-break by revenue.
  const skuAggregate = new Map<
    string,
    { name: string; qty: number; revenue: number }
  >();
  for (const row of topSkuOrders) {
    const items = (row.items as OrderItemForAgg[]) ?? [];
    for (const item of items) {
      const entry = skuAggregate.get(item.skuId) ?? {
        name: item.name ?? item.skuId,
        qty: 0,
        revenue: 0,
      };
      entry.qty += item.qty ?? 0;
      entry.revenue += item.lineTotalInr ?? 0;
      skuAggregate.set(item.skuId, entry);
    }
  }
  const topSkus = Array.from(skuAggregate.entries())
    .map(([skuId, v]) => ({ skuId, ...v }))
    .sort((a, b) => b.qty - a.qty || b.revenue - a.revenue)
    .slice(0, 5);

  // Recent orders — flat table (Artifact design), most-recent first.
  const recentRows = recent.slice(0, 5);

  // KPI deltas vs the previous equal window + sparkline series (from the real
  // daily buckets). Conversion has no daily series (no daily-sessions query), so
  // it shows a delta only; AOV is derived per-day from revenue ÷ orders.
  const revenueDelta = deltaPct(weekStats.revenue, prevRevenue);
  const ordersDelta = deltaAbs(weekStats.orderCount, prevOrders);
  const convDelta = deltaPp(conversionPct, prevConv);
  const aovDelta = deltaRupee(aov, prevAov);
  const revenueSpark = dailyBuckets.map((b) => b.revenue);
  const ordersSpark = dailyBuckets.map((b) => b.orderCount);
  const aovSpark = dailyBuckets.map((b) =>
    b.orderCount > 0 ? Math.round(b.revenue / b.orderCount) : 0,
  );

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Controls — the "Dashboard" title lives in the topbar (Artifact header) */}
      <div className="flex items-center justify-end gap-2 flex-wrap">
        <RangeTabs />
      </div>

      {/* ROW 1 — 5 KPI cards (Artifact) */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-2 sm:gap-3">
        <KpiCard
          label="Revenue"
          value={formatINR(weekStats.revenue)}
          delta={revenueDelta}
          spark={revenueSpark}
          sparkColor="#16A34A"
        />
        <KpiCard
          label="Orders"
          value={weekStats.orderCount}
          delta={ordersDelta}
          spark={ordersSpark}
          sparkColor="#E11D2A"
        />
        <KpiCard
          label="Conversion"
          value={conversionPct === null ? "—" : `${conversionPct}%`}
          delta={convDelta}
        />
        <KpiCard
          label="AOV"
          value={formatINR(aov)}
          delta={aovDelta}
          spark={aovSpark}
          sparkColor="#38b672"
        />
        <div className="bg-white rounded-2xl border border-brand-line p-3 sm:p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-mono font-bold uppercase tracking-widest text-brand-ink-soft truncate">
              Live visitors
            </p>
            <Radio
              size={14}
              className={liveVisitors > 0 ? "text-success" : "text-brand-ink-soft"}
            />
          </div>
          <p className="font-display text-[20px] font-bold text-brand-ink mt-1.5 tabular-nums">
            {liveVisitors}
          </p>
          <p className="text-[11px] font-semibold mt-1 inline-flex items-center gap-1.5">
            {liveVisitors > 0 ? (
              <span className="inline-flex items-center gap-1.5 text-success">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-success" />
                </span>
                updating live
              </span>
            ) : (
              <span className="text-brand-ink-soft">no one right now</span>
            )}
          </p>
          <p className="text-[11px] text-brand-ink-soft tabular-nums mt-0.5">
            {visitorsToday.toLocaleString("en-IN")} visitors today
          </p>
        </div>
      </div>

      {/* ROW 2 — Sales over time (70%) + Needs attention (30%) */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.7fr_1fr] gap-3 sm:gap-4">
        <section className="bg-white rounded-2xl border border-brand-line">
          <header className="px-3 sm:px-5 py-3.5 border-b border-brand-line flex items-center justify-between">
            <h2 className="font-semibold text-brand-ink text-sm">
              Sales over time{" "}
              <span className="text-brand-ink-soft font-normal">
                — {range === 1 ? "today, hourly" : `${rangeText}, paid`}
              </span>
            </h2>
            <span className="text-sm font-semibold text-brand-ink tabular-nums">
              {formatINR(totalPeriodRevenue)}
            </span>
          </header>
          <div className="p-3 sm:p-5">
            <SalesChart points={chartPoints} max={chartMax} />
          </div>
        </section>

        <section className="bg-white rounded-2xl border border-brand-line">
          <header className="px-3 sm:px-5 py-3.5 border-b border-brand-line flex items-center gap-2">
            <ListChecks size={15} className="text-brand-ink-soft" />
            <h2 className="font-semibold text-brand-ink text-sm">Needs attention</h2>
            {tasks.length > 0 && (
              <span className="ml-auto text-xs font-mono font-bold text-brand-red tabular-nums">
                {tasks.length}
              </span>
            )}
          </header>
          {tasks.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <CheckCircle2 size={28} className="text-success mx-auto mb-2" />
              <p className="text-sm text-brand-ink-soft">
                All clear. Nothing needs you right now.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-brand-line">
              {tasks.map((t, i) => (
                <li key={i}>
                  <Link
                    href={t.href}
                    className="flex items-center gap-3 px-3 sm:px-5 py-2.5 hover:bg-brand-cream transition-colors"
                  >
                    <span
                      className={`w-2 h-2 rounded-full shrink-0 ${
                        t.tone === "bad"
                          ? "bg-brand-red"
                          : t.tone === "warn"
                            ? "bg-gold"
                            : "bg-blue-500"
                      }`}
                    />
                    <span className="flex-1 text-[13px] text-brand-ink">
                      {t.count} {t.label}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* ── SECTION 2 — Orders requiring action ── */}
      <section className="space-y-2">
        <h2 className="text-[11px] font-mono font-bold uppercase tracking-widest text-brand-ink-soft">
          Orders requiring action
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
          <OpsCard
            icon={PhoneCall}
            label="COD verification"
            count={codPending}
            sub="waiting on a call"
            href="/cod"
            cta="Review"
            tone="warn"
          />
          <OpsCard
            icon={Truck}
            label="Ready to ship"
            count={paidUnshipped}
            sub="paid, no AWB yet"
            href="/admin/orders?view=live"
            cta="Fulfil"
            tone="warn"
          />
          <OpsCard
            icon={AlertTriangle}
            label="Failed payments"
            count={failedPayments}
            sub={rangeText}
            href="/admin/orders?view=failed"
            cta="Inspect"
            tone="bad"
          />
          <OpsCard
            icon={Bell}
            label="Abandoned checkouts"
            count={abandonedCheckouts}
            sub="recoverable carts"
            href="/admin/recovery"
            cta="Recover"
            tone="info"
          />
        </div>
      </section>

      {/* ── SECTION 3 — Product performance ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
        <section className="bg-white rounded-2xl border border-brand-line overflow-hidden">
          <header className="px-3 sm:px-5 py-3.5 border-b border-brand-line flex items-center justify-between">
            <h2 className="font-semibold text-brand-ink text-sm">Top selling products</h2>
            <Link
              href="/admin/products"
              className="text-xs text-brand-red hover:underline inline-flex items-center gap-1"
            >
              All products <ArrowUpRight size={12} />
            </Link>
          </header>
          {topSkus.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-brand-ink-soft">
              No paid orders {range === 1 ? "today" : `in the ${rangeText}`} yet.
            </p>
          ) : (
            <ul className="divide-y divide-brand-line">
              {topSkus.map((s) => {
                const stock = stockBySku.has(s.skuId) ? stockBySku.get(s.skuId)! : null;
                const img = HERO.get(s.skuId);
                return (
                  <li key={s.skuId} className="flex items-center gap-3 px-3 sm:px-5 py-2.5">
                    <span className="h-9 w-9 shrink-0 overflow-hidden rounded-lg border border-brand-line bg-brand-cream grid place-items-center">
                      {img && (
                        <Image src={img} alt="" width={36} height={36} className="h-full w-full object-contain" />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-semibold text-brand-ink">{s.name}</div>
                      <StockPill stock={stock} />
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-[13px] font-semibold text-brand-ink tabular-nums">
                        {formatINR(s.revenue)}
                      </div>
                      <div className="text-[11px] text-brand-ink-soft tabular-nums">{s.qty} sold</div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="bg-white rounded-2xl border border-brand-line overflow-hidden">
          <header className="px-3 sm:px-5 py-3.5 border-b border-brand-line flex items-center gap-2">
            <AlertTriangle
              size={15}
              className={lowStockRows.length ? "text-brand-red" : "text-brand-ink-soft"}
            />
            <h2 className="font-semibold text-brand-ink text-sm">Low stock</h2>
            <span className="ml-auto text-[11px] text-brand-ink-soft">
              under {LOW_STOCK_THRESHOLD} units
            </span>
          </header>
          {lowStockRows.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <CheckCircle2 size={26} className="text-success mx-auto mb-2" />
              <p className="text-sm text-brand-ink-soft">Every variant is stocked.</p>
            </div>
          ) : (
            <ul className="divide-y divide-brand-line">
              {lowStockRows.map((r) => (
                <li
                  key={`${r.sku_id}:${r.variant_slug}`}
                  className="flex items-center gap-3 px-3 sm:px-5 py-2.5"
                >
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/admin/products/${r.sku_id}`}
                      className="block truncate text-[13px] font-semibold text-brand-ink hover:text-brand-red"
                    >
                      {SKU_NAME.get(r.sku_id) ?? r.sku_id}
                    </Link>
                    <div className="text-[11px] text-brand-ink-soft truncate">
                      {r.variant_slug || "default"}
                    </div>
                  </div>
                  <span
                    className={`text-sm font-bold tabular-nums ${
                      r.stock === 0 ? "text-brand-red" : "text-gold"
                    }`}
                  >
                    {r.stock}
                  </span>
                  <QuickRestock skuId={r.sku_id} variantSlug={r.variant_slug} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* ── SECTION 4 — Customer insights (headline only; depth lives in Analytics) ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
        <MiniStat label="New customers" value={newCustomers.toLocaleString("en-IN")} sub={rangeText} />
        <MiniStat
          label="Returning"
          value={returningStats.returning.toLocaleString("en-IN")}
          sub={`of ${customerStats.total.toLocaleString("en-IN")} all-time`}
        />
        <MiniStat label="Repeat purchase" value={`${repeatPct}%`} sub="bought more than once" />
        <MiniStat
          label="Avg lifetime value"
          value={avgLtv > 0 ? formatINR(avgLtv) : "—"}
          sub="per paying customer"
        />
      </div>

      {/* ── SECTION 5 — Recent orders (compact, last 5) ── */}
      <div className="bg-white rounded-2xl border border-brand-line overflow-hidden">
        <div className="px-3 sm:px-5 py-3.5 border-b border-brand-line flex items-center justify-between">
          <h2 className="font-semibold text-brand-ink text-sm">Recent orders</h2>
          <Link
            href="/admin/orders"
            className="inline-flex items-center gap-1 rounded-lg border border-brand-line px-2.5 py-1 text-xs font-semibold text-brand-ink-soft hover:text-brand-ink hover:border-brand-ink transition-colors"
          >
            View all orders <ArrowUpRight size={12} />
          </Link>
        </div>
        {recentRows.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-brand-ink-soft">
            No orders yet. They&apos;ll show up here as customers check out.
          </p>
        ) : (
          <ul className="divide-y divide-brand-line">
            {recentRows.map((o) => {
              const addr = o.shippingAddress as { fullName?: string };
              return (
                <li key={o.id}>
                  <Link
                    href={`/admin/orders/${o.id}`}
                    className="flex items-center gap-3 px-3 sm:px-5 py-2.5 hover:bg-brand-cream transition-colors"
                  >
                    <span className="font-mono text-[12px] font-semibold text-brand-ink shrink-0">
                      {o.id}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[13px] text-brand-ink-soft">
                      {addr?.fullName ?? "—"}
                    </span>
                    <span className="tabular-nums text-[13px] font-semibold text-brand-ink shrink-0">
                      {formatINR(o.totalInr)}
                    </span>
                    <StatusBadge status={o.status} />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

// KPI delta descriptors — real vs-previous-period change, direction-tinted.
type Delta = { text: string; dir: "up" | "down" | "flat" };

function deltaPct(cur: number, prev: number): Delta {
  if (prev <= 0)
    return { text: cur > 0 ? "▲ new" : "— vs prev", dir: cur > 0 ? "up" : "flat" };
  const r = Math.round(((cur - prev) / prev) * 1000) / 10;
  return {
    text: `${r >= 0 ? "▲" : "▼"} ${Math.abs(r)}% vs prev`,
    dir: r > 0 ? "up" : r < 0 ? "down" : "flat",
  };
}

function deltaAbs(cur: number, prev: number): Delta {
  const d = cur - prev;
  return {
    text: `${d >= 0 ? "▲" : "▼"} ${Math.abs(d)} vs prev`,
    dir: d > 0 ? "up" : d < 0 ? "down" : "flat",
  };
}

function deltaPp(cur: number | null, prev: number | null): Delta {
  if (cur === null || prev === null) return { text: "vs prev", dir: "flat" };
  const d = Math.round((cur - prev) * 10) / 10;
  return {
    text: `${d >= 0 ? "▲" : "▼"} ${Math.abs(d)}pp vs prev`,
    dir: d > 0 ? "up" : d < 0 ? "down" : "flat",
  };
}

function deltaRupee(cur: number, prev: number): Delta {
  const d = cur - prev;
  return {
    text: `${d >= 0 ? "▲" : "▼"} ${formatINR(Math.abs(d))} vs prev`,
    dir: d > 0 ? "up" : d < 0 ? "down" : "flat",
  };
}

function KpiCard({
  label,
  value,
  delta,
  spark,
  sparkColor,
}: {
  label: string;
  value: React.ReactNode;
  delta: Delta;
  spark?: number[];
  sparkColor?: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-brand-line p-3 sm:p-4">
      <p className="text-[11px] font-mono font-bold uppercase tracking-widest text-brand-ink-soft truncate">
        {label}
      </p>
      <p className="font-display text-[20px] font-bold text-brand-ink mt-1.5 tabular-nums">
        {value}
      </p>
      <p
        className={`text-[11px] font-semibold mt-1 ${
          delta.dir === "up"
            ? "text-success"
            : delta.dir === "down"
              ? "text-brand-red"
              : "text-brand-ink-soft"
        }`}
      >
        {delta.text}
      </p>
      {spark && spark.length > 1 && (
        <Sparkline data={spark} color={sparkColor ?? "#16A34A"} />
      )}
    </div>
  );
}

// Tiny inline SVG sparkline from a real daily series (server-rendered, no JS).
function Sparkline({ data, color }: { data: number[]; color: string }) {
  const W = 120;
  const H = 28;
  const max = Math.max(1, ...data);
  const pts = data
    .map((v, i) => {
      const x = data.length === 1 ? 0 : (i / (data.length - 1)) * W;
      const y = H - (v / max) * (H - 4) - 2;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      height={H}
      preserveAspectRatio="none"
      className="mt-2 block"
    >
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

// "Sales over time" — real revenue buckets (IST hours when the window is Today,
// IST days otherwise) as a filled area chart with a green (money) gradient.
// Server-rendered SVG, no client JS. Handles the degenerate cases the old chart
// did not: an all-zero period now shows an empty state instead of drawing a
// giant flat triangle, and a single bucket no longer divides by zero.
function SalesChart({ points, max }: { points: ChartPoint[]; max: number }) {
  const W = 800;
  const H = 240;
  const PAD = 10;
  const n = points.length;
  const total = points.reduce((s, p) => s + p.revenue, 0);

  if (n === 0 || total === 0) {
    return (
      <div className="py-12 sm:py-14 text-center">
        <p className="font-display text-2xl font-bold text-brand-ink tabular-nums">
          {formatINR(0)}
        </p>
        <p className="mt-1 text-sm text-brand-ink-soft">
          No paid orders in this period yet — the chart fills in as orders land.
        </p>
      </div>
    );
  }

  const x = (i: number) => (n === 1 ? W / 2 : (i / (n - 1)) * W);
  const y = (v: number) => H - PAD - (v / max) * (H - PAD * 2);
  const line = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.revenue).toFixed(1)}`)
    .join(" ");
  const area = `${line} L${W},${H} L0,${H} Z`;

  const labelIdx = new Set<number>([0, n - 1]);
  for (let k = 1; k <= 3; k++) labelIdx.add(Math.round((k * (n - 1)) / 4));

  return (
    <div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        preserveAspectRatio="none"
        className="block h-[160px] sm:h-[240px]"
        role="img"
        aria-label="Sales over time"
      >
        <defs>
          <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#0f8a4d" stopOpacity="0.22" />
            <stop offset="1" stopColor="#0f8a4d" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#salesFill)" />
        <path
          d={line}
          fill="none"
          stroke="#0f8a4d"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <div className="mt-1.5 flex justify-between text-[10px] tabular-nums text-brand-ink-soft">
        {points.map((p, i) => (labelIdx.has(i) ? <span key={i}>{p.label}</span> : null))}
      </div>
    </div>
  );
}

const OPS_TONE: Record<"warn" | "bad" | "info", string> = {
  warn: "text-gold",
  bad: "text-brand-red",
  info: "text-blue-600",
};

/** An operational queue: count + what it means + a real destination. */
function OpsCard({
  icon: Icon,
  label,
  count,
  sub,
  href,
  cta,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  count: number;
  sub: string;
  href: string;
  cta: string;
  tone: "warn" | "bad" | "info";
}) {
  const idle = count === 0;
  return (
    <Link
      href={href}
      className="group rounded-2xl border border-brand-line bg-white p-3 sm:p-4 transition-colors hover:border-brand-ink/30"
    >
      <div className="flex items-center gap-1.5">
        <Icon size={13} className={idle ? "text-brand-ink-soft" : OPS_TONE[tone]} />
        <span className="text-[11px] font-semibold uppercase tracking-wide text-brand-ink-soft truncate">
          {label}
        </span>
      </div>
      <p
        className={`mt-1.5 font-display text-[22px] font-bold tabular-nums ${
          idle ? "text-brand-ink-soft" : "text-brand-ink"
        }`}
      >
        {count}
      </p>
      <p className="text-[11px] text-brand-ink-soft truncate">
        {idle ? "nothing waiting" : sub}
      </p>
      <span
        className={`mt-2 inline-flex items-center gap-1 text-[11px] font-semibold ${
          idle ? "text-brand-ink-soft" : "text-brand-red group-hover:underline"
        }`}
      >
        {cta} <ArrowUpRight size={11} />
      </span>
    </Link>
  );
}

function MiniStat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-brand-line bg-white p-3 sm:p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-ink-soft truncate">
        {label}
      </p>
      <p className="mt-1.5 font-display text-[20px] font-bold text-brand-ink tabular-nums truncate">
        {value}
      </p>
      {sub && <p className="text-[11px] text-brand-ink-soft truncate">{sub}</p>}
    </div>
  );
}

/** Honest about "no inventory row" vs a real zero. */
function StockPill({ stock }: { stock: number | null }) {
  if (stock === null)
    return <span className="text-[11px] text-brand-ink-soft">no stock data</span>;
  if (stock === 0)
    return <span className="text-[11px] font-semibold text-brand-red">sold out</span>;
  if (stock < LOW_STOCK_THRESHOLD)
    return <span className="text-[11px] font-semibold text-gold">{stock} left · low</span>;
  return (
    <span className="text-[11px] text-success">{stock.toLocaleString("en-IN")} in stock</span>
  );
}


function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    PENDING: "bg-gold/10 text-gold",
    PENDING_COD_VERIFICATION: "bg-amber-100 text-amber-800",
    PAID: "bg-success/10 text-success",
    PACKED: "bg-success/10 text-success",
    SHIPPED: "bg-blue-100 text-blue-700",
    DELIVERED: "bg-success/15 text-success",
    CANCELLED: "bg-brand-red/10 text-brand-red",
    REFUNDED: "bg-brand-red/10 text-brand-red",
    FAILED: "bg-brand-red/10 text-brand-red",
    ABANDONED: "bg-brand-ink-soft/10 text-brand-ink-soft",
    RETURNED: "bg-brand-red/10 text-brand-red",
  };
  return (
    <span
      className={`inline-block ${styles[status] ?? "bg-brand-line text-brand-ink"} text-[10px] font-mono uppercase tracking-widest font-semibold px-2 py-1 rounded-full whitespace-nowrap`}
    >
      {status}
    </span>
  );
}
