import Link from "next/link";
import {
  AlertTriangle,
  ArrowUpRight,
  Bell,
  CheckCircle2,
  Eye,
  IndianRupee,
  ListChecks,
  Package,
  Percent,
  PhoneCall,
  Radio,
  Repeat,
  ShoppingBag,
  Truck,
  TrendingUp,
  Users,
} from "lucide-react";
import { and, desc, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { orders } from "@/db/schema";
import { requireAdmin } from "@/lib/admin-auth";
import { formatINR } from "@/lib/utils";
import { LIVE_WINDOW_MINUTES, SOURCE_LABEL, type TrafficSource } from "@/lib/analytics";

// SKUs sold below this stock-count threshold appear in the Low-Stock card.
// Tuned to the operator's lead time from Syed (≈48 hrs to top up).
const LOW_STOCK_THRESHOLD = 10;

// Orders we consider "paid" for AOV + top-SKU aggregates. Excludes PENDING
// (UPI carts that never captured) and anything terminal-unhappy.
const PAID_STATUSES = ["PAID", "PACKED", "SHIPPED", "DELIVERED"] as const;

// Terminal-unhappy statuses. Recent orders in any of these are surfaced in the
// "Failed" bucket on the dashboard, regardless of payment method.
const FAILED_STATUSES = [
  "CANCELLED",
  "FAILED",
  "ABANDONED",
  "RETURNED",
  "REFUNDED",
] as const;

// Notifications stuck this many retries without sending → operator should look.
const STUCK_NOTIF_ATTEMPTS = 3;

type OrderItemForAgg = {
  skuId: string;
  name?: string;
  qty: number;
  lineTotalInr: number;
};

export default async function AdminOverview() {
  const ctx = await requireAdmin();

  const now = new Date();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const last7 = new Date(today);
  last7.setDate(last7.getDate() - 7);
  const last14 = new Date(today);
  last14.setDate(last14.getDate() - 13); // inclusive of today → 14 buckets
  const last30 = new Date(today);
  last30.setDate(last30.getDate() - 30);

  // IMPORTANT: interpolate ISO strings, NOT Date objects, into the sql``
  // templates below. Drizzle's postgres-js driver cannot bind a raw Date inside
  // a sql`` fragment — it throws "The string argument must be of type string".
  // Postgres casts these ISO strings to timestamptz correctly.
  const todayIso = today.toISOString();
  const last7Iso = last7.toISOString();
  const last14Iso = last14.toISOString();
  const last30Iso = last30.toISOString();
  const liveSinceIso = new Date(
    now.getTime() - LIVE_WINDOW_MINUTES * 60 * 1000,
  ).toISOString();

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
      weekCount: sql<number>`count(*) filter (where ${orders.placedAt} >= ${last7Iso} and ${orders.status} in ('PAID','PACKED','SHIPPED','DELIVERED'))::int`,
      weekRevenue: sql<number>`coalesce(sum(${orders.totalInr}) filter (where ${orders.placedAt} >= ${last7Iso} and ${orders.status} in ('PAID','PACKED','SHIPPED','DELIVERED')), 0)::int`,
      weekPaidCount: sql<number>`count(*) filter (where ${orders.placedAt} >= ${last7Iso} and ${orders.status} in ('PAID','PACKED','SHIPPED','DELIVERED'))::int`,
      weekPaidRevenue: sql<number>`coalesce(sum(${orders.totalInr}) filter (where ${orders.placedAt} >= ${last7Iso} and ${orders.status} in ('PAID','PACKED','SHIPPED','DELIVERED')), 0)::int`,
      codPending: sql<number>`count(*) filter (where ${orders.status} = 'PENDING_COD_VERIFICATION')::int`,
      paidUnshipped: sql<number>`count(*) filter (where ${orders.status} = 'PAID' and ${orders.awbCode} is null)::int`,
    })
    .from(orders)
    .where(inArray(orders.siteId, ctx.siteIds));

  // ── Query 2 of 5: every other scalar in one round-trip ──────────
  // CROSS-JOIN of 4 single-row subqueries against 4 different tables.
  // Postgres plans them in parallel and returns a single row of 5 ints.
  // Was: customerAggP + lowStockAggP + stuckNotifsP + failedJobsP.
  const siteIdsLiteral = sql`array[${sql.join(
    ctx.siteIds.map((s) => sql`${s}`),
    sql`, `,
  )}]::text[]`;
  const otherScalarsP = db.execute(sql`
    SELECT
      (SELECT count(*)::int FROM customers) AS customers_total,
      (SELECT count(*)::int FROM customers WHERE total_orders > 1) AS customers_returning,
      (SELECT count(*)::int FROM inventory WHERE site_id = ANY(${siteIdsLiteral}) AND stock < ${LOW_STOCK_THRESHOLD}) AS low_stock,
      (SELECT count(*)::int FROM notifications_outbox WHERE sent_at IS NULL AND attempts >= ${STUCK_NOTIF_ATTEMPTS}) AS stuck_notifs,
      (SELECT count(*)::int FROM shipment_jobs WHERE status = 'FAILED') AS failed_jobs
  `);

  // ── Query 5 of 5: traffic aggs + sources merged via UNION ALL ───
  // First row is the scalar block (visitorsToday/7d, sessions, live),
  // discriminated by kind='aggs'. Subsequent rows are per-source breakdowns
  // (kind='source'). Single index range scan over analytics_sessions; the
  // grouping cost is the same as the previous two-query version.
  // Was: trafficAggP + trafficSourcesP.
  const trafficP = db.execute<{
    kind: "aggs" | "source";
    source: string | null;
    visitors_today: number | null;
    visitors_7d: number | null;
    sessions_7d: number | null;
    live_visitors: number | null;
    sessions: number | null;
    visitors_for_source: number | null;
  }>(sql`
    SELECT
      'aggs'::text AS kind,
      NULL::text AS source,
      count(DISTINCT visitor_id) FILTER (WHERE started_at >= ${todayIso} AND is_bot = false)::int AS visitors_today,
      count(DISTINCT visitor_id) FILTER (WHERE started_at >= ${last7Iso} AND is_bot = false)::int AS visitors_7d,
      count(*) FILTER (WHERE started_at >= ${last7Iso} AND is_bot = false)::int AS sessions_7d,
      count(DISTINCT visitor_id) FILTER (WHERE last_seen_at >= ${liveSinceIso} AND is_bot = false)::int AS live_visitors,
      NULL::int AS sessions,
      NULL::int AS visitors_for_source
    FROM analytics_sessions
    WHERE site_id = ANY(${siteIdsLiteral})

    UNION ALL

    SELECT
      'source'::text AS kind,
      source AS source,
      NULL::int, NULL::int, NULL::int, NULL::int,
      count(*)::int AS sessions,
      count(DISTINCT visitor_id)::int AS visitors_for_source
    FROM analytics_sessions
    WHERE site_id = ANY(${siteIdsLiteral})
      AND started_at >= ${last7Iso}
      AND is_bot = false
    GROUP BY source
    ORDER BY kind, sessions DESC NULLS LAST
  `);

  // Sales graph — daily paid revenue, last 14 days. Postgres returns only days
  // that had orders; we pad the gaps below.
  const dailyRevenueP = db
    .select({
      day: sql<string>`to_char(date_trunc('day', ${orders.placedAt}), 'YYYY-MM-DD')`,
      revenue: sql<number>`coalesce(sum(${orders.totalInr}), 0)::int`,
      orderCount: sql<number>`count(*)::int`,
    })
    .from(orders)
    .where(
      and(
        sql`${orders.placedAt} >= ${last14Iso}`,
        inArray(orders.siteId, ctx.siteIds),
        inArray(orders.status, [...PAID_STATUSES]),
      ),
    )
    .groupBy(sql`date_trunc('day', ${orders.placedAt})`)
    .orderBy(sql`date_trunc('day', ${orders.placedAt})`);

  // (orderTasks, stuckNotifs, failedJobs are now folded into otherScalarsP /
  //  ordersScalarsP above — no separate query needed.)

  const topSkuP = db
    .select({ items: orders.items })
    .from(orders)
    .where(
      and(
        sql`${orders.placedAt} >= ${last30Iso}`,
        inArray(orders.siteId, ctx.siteIds),
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
    })
    .from(orders)
    .where(inArray(orders.siteId, ctx.siteIds))
    .orderBy(desc(orders.placedAt))
    .limit(40);

  // Units sold (line-item quantities, NOT order count). `items` is a JSONB
  // array per order, so we unnest it with jsonb_array_elements and sum each
  // line's qty across paid orders — today and trailing 7 days.
  const unitsSoldP = db.execute<{
    today_units: number | null;
    week_units: number | null;
  }>(sql`
    SELECT
      coalesce(sum((item->>'qty')::int) FILTER (WHERE o.placed_at >= ${todayIso}), 0)::int AS today_units,
      coalesce(sum((item->>'qty')::int) FILTER (WHERE o.placed_at >= ${last7Iso}), 0)::int AS week_units
    FROM orders o
    CROSS JOIN LATERAL jsonb_array_elements(o.items) AS item
    WHERE o.site_id = ANY(${siteIdsLiteral})
      AND o.status IN ('PAID','PACKED','SHIPPED','DELIVERED')
  `);

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
    trafficRows,
    unitsSoldRow,
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
        }>,
    ),
    trafficP
      .then(
        (rows) =>
          (Array.isArray(rows) ? rows : []) as Array<{
            kind: "aggs" | "source";
            source: string | null;
            visitors_today: number | null;
            visitors_7d: number | null;
            sessions_7d: number | null;
            live_visitors: number | null;
            sessions: number | null;
            visitors_for_source: number | null;
          }>,
      )
      .catch(() => []),
    unitsSoldP
      .then(
        (r) =>
          (Array.isArray(r) ? r[0] : null) as {
            today_units: number | null;
            week_units: number | null;
          } | null,
      )
      .catch(() => null),
  ]);
  const todayUnits = unitsSoldRow?.today_units ?? 0;
  const weekUnits = unitsSoldRow?.week_units ?? 0;
  // De-multiplex the traffic union-all result into the two shapes the page
  // already expects below. snake_case columns from the raw SQL are remapped
  // to the camelCase names the rest of this page uses.
  const trafficAggRaw = trafficRows.find((r) => r.kind === "aggs") ?? null;
  const trafficAggRow = trafficAggRaw
    ? {
        visitorsToday: trafficAggRaw.visitors_today ?? 0,
        visitors7d: trafficAggRaw.visitors_7d ?? 0,
        sessions7d: trafficAggRaw.sessions_7d ?? 0,
        live: trafficAggRaw.live_visitors ?? 0,
      }
    : null;
  const trafficSources = trafficRows
    .filter((r) => r.kind === "source" && r.source !== null)
    .map((r) => ({
      source: r.source as string,
      sessions: r.sessions ?? 0,
      visitors: r.visitors_for_source ?? 0,
    }));
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

  const todayStats = {
    orderCount: orderAggRow?.todayCount ?? 0,
    revenue: orderAggRow?.todayRevenue ?? 0,
  };
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

  const returningPct =
    returningStats.total > 0
      ? Math.round((returningStats.returning / returningStats.total) * 100)
      : 0;

  // Visitor metrics + conversion. Conversion = paid orders (7d) ÷ sessions
  // (7d). Orders are written by our own checkout and can't be ad-blocked, so
  // the numerator is exact; sessions supply an accurate, bot-filtered
  // denominator.
  const visitorsToday = trafficAggRow?.visitorsToday ?? 0;
  const visitors7d = trafficAggRow?.visitors7d ?? 0;
  const sessions7d = trafficAggRow?.sessions7d ?? 0;
  const liveVisitors = trafficAggRow?.live ?? 0;
  const conversionPct =
    sessions7d > 0
      ? Math.round((aovStats.orderCount / sessions7d) * 1000) / 10
      : null;

  // Pad daily revenue so the graph is continuous.
  const daysMap = new Map(
    dailyRevenueRows.map((r) => [r.day, { revenue: r.revenue, orderCount: r.orderCount }]),
  );
  const dailyBuckets: Array<{ date: Date; revenue: number; orderCount: number }> =
    [];
  for (let i = 0; i < 14; i++) {
    const d = new Date(last14);
    d.setDate(d.getDate() + i);
    const key = ymd(d);
    const row = daysMap.get(key);
    dailyBuckets.push({
      date: d,
      revenue: row?.revenue ?? 0,
      orderCount: row?.orderCount ?? 0,
    });
  }
  const maxRevenue = Math.max(1, ...dailyBuckets.map((b) => b.revenue));
  const total14dRevenue = dailyBuckets.reduce((s, b) => s + b.revenue, 0);

  // Traffic sources → percentages.
  const sourcesTotal = trafficSources.reduce((s, r) => s + r.sessions, 0);

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
      href: "/admin/inventory",
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

  // Split recent orders into three operator-facing buckets:
  //   - Failed: any terminal-unhappy status (takes precedence over method)
  //   - COD:    cash-on-delivery that's still live
  //   - Online: prepaid (UPI/card/netbanking/wallet) that's still live
  // Each capped at 6 so the card stays scannable on a phone.
  const RECENT_PER_GROUP = 6;
  const recentFailed = recent
    .filter((o) => (FAILED_STATUSES as readonly string[]).includes(o.status))
    .slice(0, RECENT_PER_GROUP);
  const recentCod = recent
    .filter(
      (o) =>
        o.paymentMethod === "COD" &&
        !(FAILED_STATUSES as readonly string[]).includes(o.status),
    )
    .slice(0, RECENT_PER_GROUP);
  const recentOnline = recent
    .filter(
      (o) =>
        o.paymentMethod !== "COD" &&
        !(FAILED_STATUSES as readonly string[]).includes(o.status),
    )
    .slice(0, RECENT_PER_GROUP);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-brand-ink">
          Welcome back{ctx.name ? `, ${ctx.name}` : ""}.
        </h1>
        <p className="text-sm text-brand-ink-soft mt-1">
          {ctx.siteIds.length === 1
            ? `Managing ${ctx.siteIds[0]}.`
            : `Managing ${ctx.siteIds.length} sites.`}
        </p>
      </div>

      {/* Row 1 — order velocity */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
        <StatCard
          label="Today"
          value={todayStats.orderCount}
          sub={`${formatINR(todayStats.revenue)} revenue`}
          icon={Package}
        />
        <StatCard
          label="Last 7 days"
          value={weekStats.orderCount}
          sub={`${formatINR(weekStats.revenue)} revenue`}
          icon={IndianRupee}
        />
        <StatCard
          label="AOV (7d, paid)"
          value={formatINR(aov)}
          sub={
            aovStats.orderCount
              ? `Across ${aovStats.orderCount} paid order${aovStats.orderCount === 1 ? "" : "s"}`
              : "No paid orders yet"
          }
          icon={TrendingUp}
        />
        <StatCard
          label="Products sold (7d)"
          value={weekUnits}
          sub={`${todayUnits} today · units, paid only`}
          icon={ShoppingBag}
        />
      </div>

      {/* Row 2 — traffic + conversion */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
        <StatCard
          label="Visitors (7d)"
          value={visitors7d}
          sub={`${visitorsToday} today`}
          icon={Eye}
        />
        <StatCard
          label="Conversion (7d)"
          value={conversionPct === null ? "—" : `${conversionPct}%`}
          sub={
            sessions7d
              ? `${aovStats.orderCount} paid / ${sessions7d} sessions`
              : "No sessions tracked yet"
          }
          icon={Percent}
        />
        <div className="bg-white rounded-2xl border border-brand-line p-4 sm:p-5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] sm:text-xs font-mono font-bold uppercase tracking-widest text-brand-ink-soft truncate">
              Live now
            </p>
            <Radio
              size={16}
              className={liveVisitors > 0 ? "text-success" : "text-brand-ink-soft"}
            />
          </div>
          <p className="font-display text-2xl sm:text-3xl font-bold text-brand-ink mt-2 inline-flex items-center gap-2">
            {liveVisitors > 0 && (
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-success" />
              </span>
            )}
            {liveVisitors}
          </p>
          <p className="text-xs text-brand-ink-soft mt-1">
            Visitors active in the last {LIVE_WINDOW_MINUTES} min
          </p>
        </div>
      </div>

      {/* Row 3 — customer + ops health */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
        <StatCard
          label="Customers (all-time)"
          value={customerStats.total}
          sub="Unique phone numbers"
          icon={Users}
        />
        <StatCard
          label="Returning customers"
          value={`${returningPct}%`}
          sub={
            returningStats.total
              ? `${returningStats.returning} of ${returningStats.total} bought again`
              : "Need first orders to compute"
          }
          icon={Repeat}
        />
        <Link
          href="/admin/inventory"
          className="bg-white rounded-2xl border border-brand-line p-4 sm:p-5 hover:border-brand-red transition-colors"
        >
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] sm:text-xs font-mono font-bold uppercase tracking-widest text-brand-ink-soft truncate">
              Low stock (&lt;{LOW_STOCK_THRESHOLD})
            </p>
            <AlertTriangle
              size={16}
              className={
                lowStockCount > 0 ? "text-brand-red" : "text-brand-ink-soft"
              }
            />
          </div>
          <p
            className={`font-display text-2xl sm:text-3xl font-bold mt-2 ${
              lowStockCount > 0 ? "text-brand-red" : "text-brand-ink"
            }`}
          >
            {lowStockCount}
          </p>
          <p className="text-xs text-brand-ink-soft mt-1">
            {lowStockCount > 0
              ? "Variant SKUs need restock — tap to fix"
              : "All variants stocked"}
          </p>
        </Link>
      </div>

      {/* Sales graph + Tasks side by side on desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sales graph — 14 days */}
        <section className="lg:col-span-2 bg-white rounded-2xl border border-brand-line">
          <header className="px-5 py-4 border-b border-brand-line flex items-center justify-between">
            <h2 className="font-semibold text-brand-ink">
              Sales{" "}
              <span className="text-brand-ink-soft font-normal">
                — last 14 days, paid
              </span>
            </h2>
            <span className="text-sm font-semibold text-brand-ink tabular-nums">
              {formatINR(total14dRevenue)}
            </span>
          </header>
          <div className="p-5">
            <div className="flex items-end gap-1.5 h-40">
              {dailyBuckets.map((b) => {
                const isToday = ymd(b.date) === ymd(today);
                const height = `${Math.max(2, (b.revenue / maxRevenue) * 100)}%`;
                return (
                  <div
                    key={ymd(b.date)}
                    className="flex-1 flex flex-col items-center gap-1.5 h-full"
                  >
                    <div
                      className="w-full flex-1 flex items-end"
                      title={`${shortDate(b.date)}: ${formatINR(b.revenue)} (${b.orderCount} order${b.orderCount === 1 ? "" : "s"})`}
                    >
                      <div
                        className={`w-full rounded-t transition-all ${
                          b.revenue === 0
                            ? "bg-brand-line"
                            : isToday
                              ? "bg-brand-red"
                              : "bg-brand-ink"
                        }`}
                        style={{ height }}
                      />
                    </div>
                    <span
                      className={`text-[9px] font-mono ${
                        isToday
                          ? "text-brand-red font-semibold"
                          : "text-brand-ink-soft"
                      }`}
                    >
                      {b.date.getDate()}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Tasks & notifications */}
        <section className="bg-white rounded-2xl border border-brand-line">
          <header className="px-5 py-4 border-b border-brand-line flex items-center gap-2">
            <ListChecks size={16} className="text-brand-ink-soft" />
            <h2 className="font-semibold text-brand-ink">Tasks</h2>
            {tasks.length > 0 && (
              <span className="ml-auto text-xs font-mono font-bold text-brand-red tabular-nums">
                {tasks.length} need attention
              </span>
            )}
          </header>
          {tasks.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <CheckCircle2
                size={28}
                className="text-success mx-auto mb-2"
              />
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
                    className="flex items-center gap-3 px-5 py-3 hover:bg-brand-cream transition-colors"
                  >
                    <span
                      className={`shrink-0 ${
                        t.tone === "bad"
                          ? "text-brand-red"
                          : t.tone === "warn"
                            ? "text-gold"
                            : "text-brand-ink-soft"
                      }`}
                    >
                      <t.icon size={16} />
                    </span>
                    <span className="flex-1 text-sm text-brand-ink">
                      {t.label}
                    </span>
                    <span
                      className={`shrink-0 font-display font-bold tabular-nums ${
                        t.tone === "bad"
                          ? "text-brand-red"
                          : t.tone === "warn"
                            ? "text-gold"
                            : "text-brand-ink"
                      }`}
                    >
                      {t.count}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Traffic sources */}
      <section className="bg-white rounded-2xl border border-brand-line">
        <header className="px-5 py-4 border-b border-brand-line flex items-center justify-between">
          <h2 className="font-semibold text-brand-ink">
            Traffic sources{" "}
            <span className="text-brand-ink-soft font-normal">
              — last 7 days
            </span>
          </h2>
          <Link
            href="/admin/analytics"
            className="text-sm text-brand-red hover:underline inline-flex items-center gap-1"
          >
            Analytics <ArrowUpRight size={14} />
          </Link>
        </header>
        {sourcesTotal === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-brand-ink-soft">
            No visitor sessions tracked yet. Data appears here once traffic
            starts flowing.
          </p>
        ) : (
          <ul className="divide-y divide-brand-line">
            {trafficSources.map((s) => {
              const pct = Math.round((s.sessions / sourcesTotal) * 100);
              return (
                <li key={s.source} className="px-5 py-3">
                  <div className="flex items-center justify-between text-sm mb-1.5">
                    <span className="font-semibold text-brand-ink">
                      {SOURCE_LABEL[s.source as TrafficSource] ?? s.source}
                    </span>
                    <span className="text-brand-ink-soft tabular-nums">
                      {s.sessions} session{s.sessions === 1 ? "" : "s"} · {s.visitors}{" "}
                      visitor{s.visitors === 1 ? "" : "s"}{" "}
                      <span className="font-semibold text-brand-ink">
                        ({pct}%)
                      </span>
                    </span>
                  </div>
                  <div className="bg-brand-cream rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-brand-ink h-full rounded-full"
                      style={{ width: `${Math.max(2, pct)}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Top SKUs */}
      <div className="bg-white rounded-2xl border border-brand-line">
        <div className="px-5 py-4 border-b border-brand-line flex items-center justify-between">
          <h2 className="font-semibold text-brand-ink">
            Top SKUs{" "}
            <span className="text-brand-ink-soft font-normal">
              — last 30 days, paid only
            </span>
          </h2>
          <Link
            href="/admin/inventory"
            className="text-sm text-brand-red hover:underline inline-flex items-center gap-1"
          >
            Inventory <ArrowUpRight size={14} />
          </Link>
        </div>
        {topSkus.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-brand-ink-soft">
            No paid orders in the last 30 days yet.
          </p>
        ) : (
          <ul className="divide-y divide-brand-line">
            {topSkus.map((s, i) => (
              <li key={s.skuId} className="flex items-center gap-4 px-5 py-3">
                <span className="font-mono text-xs text-brand-ink-soft w-6 tabular-nums">
                  #{i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-brand-ink truncate">
                    {s.name}
                  </div>
                  <div className="text-xs text-brand-ink-soft font-mono mt-0.5">
                    {s.skuId}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-semibold text-brand-ink tabular-nums">
                    {s.qty} sold
                  </div>
                  <div className="text-xs text-brand-ink-soft tabular-nums mt-0.5">
                    {formatINR(s.revenue)}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Recent orders */}
      <div className="bg-white rounded-2xl border border-brand-line">
        <div className="px-5 py-4 border-b border-brand-line flex items-center justify-between">
          <h2 className="font-semibold text-brand-ink">Recent orders</h2>
          <Link
            href="/admin/orders"
            className="text-sm text-brand-red hover:underline inline-flex items-center gap-1"
          >
            View all <ArrowUpRight size={14} />
          </Link>
        </div>
        {recent.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-brand-ink-soft">
            No orders yet. They&apos;ll show up here as customers check out.
          </p>
        ) : (
          <div className="grid grid-cols-3 divide-x divide-brand-line">
            <RecentOrderGroup title="Online" tone="ink" orders={recentOnline} />
            <RecentOrderGroup title="COD" tone="gold" orders={recentCod} />
            <RecentOrderGroup title="Failed" tone="red" orders={recentFailed} />
          </div>
        )}
      </div>
    </div>
  );
}

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function shortDate(d: Date): string {
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

// One labelled bucket of recent orders (Online / COD / Failed). Renders a
// header with a tone dot + count, then the order rows — or a muted empty line
// so every bucket is always visible and the operator knows it was checked.
function RecentOrderGroup({
  title,
  tone,
  orders,
}: {
  title: string;
  tone: "ink" | "gold" | "red";
  orders: Array<{
    id: string;
    status: string;
    paymentMethod: string;
    totalInr: number;
    placedAt: Date;
  }>;
}) {
  const dot =
    tone === "red" ? "bg-brand-red" : tone === "gold" ? "bg-gold" : "bg-brand-ink";
  return (
    <div>
      <div className="flex items-center gap-1.5 px-2.5 sm:px-5 py-2.5 bg-brand-cream/60">
        <span className={`w-2 h-2 rounded-full shrink-0 ${dot}`} />
        <span className="text-[10px] sm:text-xs font-mono font-bold uppercase tracking-wide sm:tracking-widest text-brand-ink-soft">
          {title}
        </span>
        <span className="text-[10px] sm:text-xs text-brand-ink-soft tabular-nums">
          {orders.length}
        </span>
      </div>
      {orders.length === 0 ? (
        <p className="px-2.5 sm:px-5 py-4 text-[10px] sm:text-xs text-brand-ink-soft">
          No recent {title.toLowerCase()} orders.
        </p>
      ) : (
        <ul className="divide-y divide-brand-line">
          {orders.map((o) => (
            <li key={o.id}>
              <Link
                href={`/admin/orders/${o.id}`}
                className="flex flex-col gap-1 lg:flex-row lg:items-center lg:gap-4 px-2.5 sm:px-5 py-2.5 sm:py-3 hover:bg-brand-cream transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="font-mono font-semibold text-brand-ink text-xs sm:text-base break-all">
                    {o.id}
                  </div>
                  <div className="text-[10px] sm:text-xs text-brand-ink-soft mt-0.5">
                    {new Date(o.placedAt).toLocaleString("en-IN", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}{" "}
                    · {o.paymentMethod}
                  </div>
                </div>
                <StatusBadge status={o.status} />
                <div className="font-semibold text-brand-ink tabular-nums text-xs sm:text-base">
                  {formatINR(o.totalInr)}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
}: {
  label: string;
  value: number | string;
  sub: string;
  icon: React.ComponentType<{ size?: number }>;
}) {
  return (
    <div className="bg-white rounded-2xl border border-brand-line p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] sm:text-xs font-mono font-bold uppercase tracking-widest text-brand-ink-soft truncate">
          {label}
        </p>
        <Icon size={16} />
      </div>
      <p className="font-display text-2xl sm:text-3xl font-bold text-brand-ink mt-2 break-words">
        {value}
      </p>
      <p className="text-xs text-brand-ink-soft mt-1">{sub}</p>
    </div>
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
      className={`hidden sm:inline-block ${styles[status] ?? "bg-brand-line text-brand-ink"} text-[10px] font-mono uppercase tracking-widest font-semibold px-2 py-1 rounded-full`}
    >
      {status}
    </span>
  );
}
