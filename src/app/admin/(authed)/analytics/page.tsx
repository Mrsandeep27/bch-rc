import Image from "next/image";
import Link from "next/link";
import { and, count, desc, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { ArrowDown, ArrowUp, Download, Users } from "lucide-react";
import { db } from "@/db";
import { analyticsSessions, customers, orders } from "@/db/schema";
import { requireAdmin } from "@/lib/admin-auth";
import { formatINR } from "@/lib/utils";
import { PAID_STATUSES, bucketOfStatus } from "@/lib/order-status";
import { PRODUCTS } from "@/lib/products";
import { getFunnelReport } from "@/lib/funnel-queries";
import {
  addUtcDays,
  istDayStart,
  istShortDate,
  istWeekdayMon0,
  istYmd,
} from "@/lib/tz";
import { safePct } from "@/lib/analytics-validation";
import {
  analyticsWindow,
  getAudience,
  getReturningVisitors,
  getVisitors,
  warnIfInsane,
} from "@/lib/analytics-service";
import RevenueChart, { type ChartPoint } from "./RevenueChart";
import TrafficDonut from "./TrafficDonut";

export const dynamic = "force-dynamic";

type OrderItemForAgg = {
  skuId: string;
  name?: string;
  qty: number;
  lineTotalInr: number;
};

const RANGES = [
  { d: 1, label: "Today" },
  { d: 7, label: "7 days" },
  { d: 30, label: "30 days" },
  { d: 90, label: "90 days" },
] as const;

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "products", label: "Products" },
  { key: "customers", label: "Customers" },
  { key: "marketing", label: "Marketing" },
  { key: "operations", label: "Operations" },
] as const;
type Tab = (typeof TABS)[number]["key"];

const SOURCE_LABEL: Record<string, string> = {
  direct: "Direct",
  instagram: "Instagram",
  google: "Google",
  whatsapp: "WhatsApp",
  facebook: "Facebook",
  youtube: "YouTube",
  referral: "Referral",
  organic: "Organic",
};
const srcLabel = (s: string | null) =>
  !s ? "Direct" : SOURCE_LABEL[s] ?? s.charAt(0).toUpperCase() + s.slice(1);

const HERO = new Map(PRODUCTS.map((p) => [p.id, p.heroImage]));

/** % change vs the previous equal-length window. null when there's no baseline. */
function deltaPct(cur: number, prev: number): number | null {
  if (prev <= 0) return null;
  return ((cur - prev) / prev) * 100;
}

export default async function AdminAnalytics({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; range?: string }>;
}) {
  const ctx = await requireAdmin();
  const sp = await searchParams;

  const range = RANGES.some((r) => r.d === Number(sp.range)) ? Number(sp.range) : 30;
  const tab: Tab = (TABS.find((t) => t.key === sp.tab)?.key ?? "overview") as Tab;

  // ONE window for every page — IST-day-aligned, inclusive of today.
  const win = analyticsWindow(range);
  const today = istDayStart();
  const windowStart = win.start;
  const prevStart = win.prevStart;

  const dow = istWeekdayMon0(today);
  const last12Weeks = addUtcDays(today, -(dow + 11 * 7));

  const paidFilter = sql`${orders.status} in ('PAID','PACKED','SHIPPED','DELIVERED')`;

  const [
    dailyRevenueRows,
    paidVsFailedRows,
    paidOrdersForSku,
    weeklyCustomerRows,
    totalStats,
    sourceRows,
    campaignRows,
    paymentOutcomeRows,
    geoRows,
    deviceStats,
    audience,
    returningVisitors,
    cohort,
    dailyCustomerRows,
    prevOrderStats,
    prevVisitors,
    prevNewCustomers,
  ] = await Promise.all([
    db
      .select({
        day: sql<string>`to_char(date_trunc('day', ${orders.placedAt} AT TIME ZONE 'Asia/Kolkata'), 'YYYY-MM-DD')`,
        revenue: sql<number>`coalesce(sum(${orders.totalInr}), 0)::int`,
        orderCount: sql<number>`count(*)::int`,
      })
      .from(orders)
      .where(
        and(
          gte(orders.placedAt, windowStart),
          inArray(orders.siteId, ctx.siteIds),
          inArray(orders.status, [...PAID_STATUSES]),
        ),
      )
      .groupBy(sql`date_trunc('day', ${orders.placedAt} AT TIME ZONE 'Asia/Kolkata')`)
      .orderBy(sql`date_trunc('day', ${orders.placedAt} AT TIME ZONE 'Asia/Kolkata')`),
    db
      .select({ status: orders.status, count: sql<number>`count(*)::int` })
      .from(orders)
      .where(and(gte(orders.placedAt, windowStart), inArray(orders.siteId, ctx.siteIds)))
      .groupBy(orders.status),
    db
      .select({ items: orders.items })
      .from(orders)
      .where(
        and(
          gte(orders.placedAt, windowStart),
          inArray(orders.siteId, ctx.siteIds),
          inArray(orders.status, [...PAID_STATUSES]),
        ),
      ),
    db
      .select({
        week: sql<string>`to_char(date_trunc('week', ${customers.createdAt} AT TIME ZONE 'Asia/Kolkata'), 'YYYY-MM-DD')`,
        count: sql<number>`count(*)::int`,
      })
      .from(customers)
      .where(
        and(
          gte(customers.createdAt, last12Weeks),
          inArray(customers.firstSiteId, ctx.siteIds),
        ),
      )
      .groupBy(sql`date_trunc('week', ${customers.createdAt} AT TIME ZONE 'Asia/Kolkata')`)
      .orderBy(sql`date_trunc('week', ${customers.createdAt} AT TIME ZONE 'Asia/Kolkata')`),
    db
      .select({
        orderCount: count(orders.id),
        revenue: sql<number>`coalesce(sum(${orders.totalInr}), 0)::int`,
      })
      .from(orders)
      .where(
        and(
          gte(orders.placedAt, windowStart),
          inArray(orders.siteId, ctx.siteIds),
          inArray(orders.status, [...PAID_STATUSES]),
        ),
      )
      .then((rows) => rows[0]),
    db
      .select({
        source: orders.source,
        attempts: sql<number>`count(*)::int`,
        paid: sql<number>`count(*) filter (where ${paidFilter})::int`,
        revenue: sql<number>`coalesce(sum(${orders.totalInr}) filter (where ${paidFilter}), 0)::int`,
      })
      .from(orders)
      .where(and(gte(orders.placedAt, windowStart), inArray(orders.siteId, ctx.siteIds)))
      .groupBy(orders.source)
      .orderBy(desc(sql`count(*) filter (where ${paidFilter})`)),
    db
      .select({
        campaign: orders.utmCampaign,
        source: orders.source,
        paid: sql<number>`count(*) filter (where ${paidFilter})::int`,
        revenue: sql<number>`coalesce(sum(${orders.totalInr}) filter (where ${paidFilter}), 0)::int`,
      })
      .from(orders)
      .where(
        and(
          gte(orders.placedAt, windowStart),
          inArray(orders.siteId, ctx.siteIds),
          sql`${orders.utmCampaign} is not null`,
        ),
      )
      .groupBy(orders.utmCampaign, orders.source)
      .orderBy(desc(sql`count(*) filter (where ${paidFilter})`))
      .limit(10),
    db
      .select({
        method: orders.paymentMethod,
        status: orders.status,
        count: sql<number>`count(*)::int`,
      })
      .from(orders)
      .where(and(gte(orders.placedAt, windowStart), inArray(orders.siteId, ctx.siteIds)))
      .groupBy(orders.paymentMethod, orders.status),
    db
      .select({
        state: sql<string>`coalesce(nullif(${orders.shippingAddress}->>'state', ''), 'Unknown')`,
        paid: sql<number>`count(*)::int`,
        revenue: sql<number>`coalesce(sum(${orders.totalInr}), 0)::int`,
      })
      .from(orders)
      .where(
        and(
          gte(orders.placedAt, windowStart),
          inArray(orders.siteId, ctx.siteIds),
          inArray(orders.status, [...PAID_STATUSES]),
        ),
      )
      .groupBy(sql`coalesce(nullif(${orders.shippingAddress}->>'state', ''), 'Unknown')`)
      .orderBy(desc(sql`count(*)`))
      .limit(8),
    db
      .select({
        total: sql<number>`count(*)::int`,
        tablet: sql<number>`count(*) filter (where ${analyticsSessions.userAgent} ~* 'ipad|tablet|playbook|silk')::int`,
        mobile: sql<number>`count(*) filter (where ${analyticsSessions.userAgent} ~* 'mobi|iphone|ipod|android.*mobile|windows phone|blackberry' and ${analyticsSessions.userAgent} !~* 'ipad|tablet|playbook|silk')::int`,
      })
      .from(analyticsSessions)
      .where(
        and(
          gte(analyticsSessions.startedAt, windowStart),
          inArray(analyticsSessions.siteId, ctx.siteIds),
          eq(analyticsSessions.isBot, false),
        ),
      )
      .then((rows) => rows[0]),
    // VISITORS / SESSIONS / PAGEVIEWS — canonical, from the analytics service.
    getAudience(ctx.siteIds, { from: windowStart }),
    getReturningVisitors(ctx.siteIds, windowStart),
    db
      .select({
        one: sql<number>`count(*) filter (where ${customers.totalOrders} = 1)::int`,
        two: sql<number>`count(*) filter (where ${customers.totalOrders} = 2)::int`,
        threePlus: sql<number>`count(*) filter (where ${customers.totalOrders} >= 3)::int`,
        buyers: sql<number>`count(*) filter (where ${customers.totalOrders} >= 1)::int`,
      })
      .from(customers)
      .where(inArray(customers.firstSiteId, ctx.siteIds))
      .then((rows) => rows[0]),

    // ── Additive (new) — needed for the KPI deltas + the Customers chart line.
    // Same IST bucketing + site scoping as everything above.
    db
      .select({
        day: sql<string>`to_char(date_trunc('day', ${customers.createdAt} AT TIME ZONE 'Asia/Kolkata'), 'YYYY-MM-DD')`,
        count: sql<number>`count(*)::int`,
      })
      .from(customers)
      .where(
        and(
          gte(customers.createdAt, windowStart),
          inArray(customers.firstSiteId, ctx.siteIds),
        ),
      )
      .groupBy(sql`date_trunc('day', ${customers.createdAt} AT TIME ZONE 'Asia/Kolkata')`),
    db
      .select({
        orderCount: count(orders.id),
        revenue: sql<number>`coalesce(sum(${orders.totalInr}), 0)::int`,
      })
      .from(orders)
      .where(
        and(
          gte(orders.placedAt, prevStart),
          lt(orders.placedAt, windowStart),
          inArray(orders.siteId, ctx.siteIds),
          inArray(orders.status, [...PAID_STATUSES]),
        ),
      )
      .then((rows) => rows[0]),
    getVisitors(ctx.siteIds, prevStart, windowStart),
    db
      .select({ c: sql<number>`count(*)::int` })
      .from(customers)
      .where(
        and(
          gte(customers.createdAt, prevStart),
          lt(customers.createdAt, windowStart),
          inArray(customers.firstSiteId, ctx.siteIds),
        ),
      )
      .then((rows) => rows[0]?.c ?? 0),
  ]);

  // ── Daily buckets (padded) ────────────────────────────────────────────────
  const daysMap = new Map(
    dailyRevenueRows.map((r) => [r.day, { revenue: r.revenue, orderCount: r.orderCount }]),
  );
  const custMap = new Map(dailyCustomerRows.map((r) => [r.day, r.count]));
  const chartPoints: ChartPoint[] = [];
  let newCustomersWindow = 0;
  const revenueSeries: number[] = [];
  for (let i = 0; i < range; i++) {
    const d = addUtcDays(windowStart, i);
    const key = istYmd(d);
    const row = daysMap.get(key);
    const c = custMap.get(key) ?? 0;
    newCustomersWindow += c;
    revenueSeries.push(row?.revenue ?? 0);
    chartPoints.push({
      label: istShortDate(d),
      revenue: row?.revenue ?? 0,
      orders: row?.orderCount ?? 0,
      customers: c,
    });
  }

  // ── Status mix (unchanged bucketing) ──────────────────────────────────────
  let liveCount = 0;
  let pendingCount = 0;
  let failedCount = 0;
  let otherCount = 0;
  for (const row of paidVsFailedRows) {
    switch (bucketOfStatus(row.status)) {
      case "live": liveCount += row.count; break;
      case "pending": pendingCount += row.count; break;
      case "failed": failedCount += row.count; break;
      default: otherCount += row.count;
    }
  }
  const statusTotal = liveCount + pendingCount + failedCount + otherCount;
  const statusPct = (n: number) => Math.round(safePct(n, statusTotal));

  // ── Best sellers (unchanged aggregation) ──────────────────────────────────
  const skuAggregate = new Map<string, { name: string; qty: number; revenue: number }>();
  for (const row of paidOrdersForSku) {
    const items = (row.items as OrderItemForAgg[]) ?? [];
    for (const item of items) {
      const entry = skuAggregate.get(item.skuId) ?? { name: item.name ?? item.skuId, qty: 0, revenue: 0 };
      entry.qty += item.qty ?? 0;
      entry.revenue += item.lineTotalInr ?? 0;
      skuAggregate.set(item.skuId, entry);
    }
  }
  const bestSellers = Array.from(skuAggregate.entries())
    .map(([skuId, v]) => ({ skuId, ...v }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);

  // ── Weekly new customers (unchanged) ──────────────────────────────────────
  const weeklyMap = new Map(weeklyCustomerRows.map((r) => [r.week, r.count]));
  const weeklyBuckets: Array<{ weekStart: Date; count: number }> = [];
  for (let i = 0; i < 12; i++) {
    const d = addUtcDays(last12Weeks, i * 7);
    weeklyBuckets.push({ weekStart: d, count: weeklyMap.get(istYmd(d)) ?? 0 });
  }
  const maxWeekly = Math.max(1, ...weeklyBuckets.map((b) => b.count));

  // ── Payment outcome (unchanged) ───────────────────────────────────────────
  const PAID_SET = new Set<string>(PAID_STATUSES);
  type MethodAgg = {
    method: string; attempts: number; paid: number; failed: number;
    abandoned: number; cancelled: number; pending: number;
  };
  const methodMap = new Map<string, MethodAgg>();
  for (const r of paymentOutcomeRows) {
    const m = methodMap.get(r.method) ?? {
      method: r.method, attempts: 0, paid: 0, failed: 0, abandoned: 0, cancelled: 0, pending: 0,
    };
    m.attempts += r.count;
    if (PAID_SET.has(r.status)) m.paid += r.count;
    else if (r.status === "FAILED") m.failed += r.count;
    else if (r.status === "ABANDONED") m.abandoned += r.count;
    else if (r.status === "CANCELLED") m.cancelled += r.count;
    else if (r.status === "PENDING" || r.status === "PENDING_COD_VERIFICATION") m.pending += r.count;
    methodMap.set(r.method, m);
  }
  const methodAggs = Array.from(methodMap.values()).sort((a, b) => b.attempts - a.attempts);

  let codPaid = 0;
  let prepaidPaid = 0;
  for (const m of methodAggs) {
    if (m.method === "COD") codPaid += m.paid;
    else prepaidPaid += m.paid;
  }
  const paidSplitTotal = codPaid + prepaidPaid;
  let codDispatched = 0;
  let codReturned = 0;
  for (const r of paymentOutcomeRows) {
    if (r.method !== "COD") continue;
    if (["SHIPPED", "DELIVERED", "RETURNED"].includes(r.status)) codDispatched += r.count;
    if (r.status === "RETURNED") codReturned += r.count;
  }
  const codRtoPct = codDispatched > 0 ? Math.round((codReturned / codDispatched) * 100) : null;

  const devTotal = deviceStats?.total ?? 0;
  const devMobile = deviceStats?.mobile ?? 0;
  const devTablet = deviceStats?.tablet ?? 0;
  const devDesktop = Math.max(0, devTotal - devMobile - devTablet);
  const devPct = (n: number) => (devTotal === 0 ? 0 : Math.round((n / devTotal) * 100));

  // VISITOR = unique person. SESSION = one visit. They are NOT the same number.
  const activeV = audience.visitors;
  const sessions = audience.sessions;
  const returningV = returningVisitors;
  const newV = Math.max(0, activeV - returningV);
  const returningPct = activeV === 0 ? 0 : Math.round((returningV / activeV) * 100);

  warnIfInsane("analytics", {
    visitors: activeV,
    sessions,
    pageviews: audience.pageviews,
  });

  const buyers = cohort?.buyers ?? 0;
  const repeatBuyers = (cohort?.two ?? 0) + (cohort?.threePlus ?? 0);
  const repeatRate = buyers === 0 ? 0 : Math.round((repeatBuyers / buyers) * 100);

  // ── KPIs ──────────────────────────────────────────────────────────────────
  const revenue = totalStats?.revenue ?? 0;
  const orderCount = totalStats?.orderCount ?? 0;
  const prevRevenue = prevOrderStats?.revenue ?? 0;
  const prevOrders = prevOrderStats?.orderCount ?? 0;

  const aov = orderCount > 0 ? Math.round(revenue / orderCount) : 0;
  const prevAov = prevOrders > 0 ? Math.round(prevRevenue / prevOrders) : 0;
  const conv = safePct(orderCount, activeV);
  const prevConv = safePct(prevOrders, prevVisitors);

  const funnel = tab === "overview" ? await getFunnelReport(ctx.siteIds, range) : null;

  const usePaid = sourceRows.some((r) => r.paid > 0);
  const donutSlices = sourceRows
    .map((r) => ({
      label: srcLabel(r.source),
      value: usePaid ? r.paid : r.attempts,
      revenue: r.revenue,
    }))
    .filter((s) => s.value > 0)
    .slice(0, 6);

  const qs = (next: Partial<{ tab: string; range: number }>) => {
    const t = next.tab ?? tab;
    const r = next.range ?? range;
    const parts: string[] = [];
    if (t !== "overview") parts.push(`tab=${t}`);
    if (r !== 30) parts.push(`range=${r}`);
    return `/admin/analytics${parts.length ? `?${parts.join("&")}` : ""}`;
  };

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-xl sm:text-2xl font-bold text-brand-ink">Analytics</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex gap-1 rounded-full bg-brand-cream p-1">
            {RANGES.map((r) => (
              <Link
                key={r.d}
                href={qs({ range: r.d })}
                aria-current={r.d === range ? "page" : undefined}
                className={`rounded-full px-3 py-2.5 sm:py-1.5 text-xs font-semibold transition-colors ${
                  r.d === range ? "bg-brand-ink text-white" : "text-brand-ink-soft hover:text-brand-ink"
                }`}
              >
                {r.label}
              </Link>
            ))}
          </div>
          {/* Real export: hits the admin-gated CSV route directly. */}
          <a
            href="/api/admin/export?dataset=orders"
            download
            className="inline-flex items-center gap-1.5 rounded-lg border border-brand-line bg-white px-3 py-2.5 sm:py-2 text-xs font-semibold text-brand-ink hover:border-brand-ink transition-colors"
          >
            <Download size={14} /> Export
          </a>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto no-scrollbar border-b border-brand-line">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={qs({ tab: t.key })}
            className={`shrink-0 px-3.5 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors ${
              t.key === tab
                ? "border-brand-red text-brand-ink"
                : "border-transparent text-brand-ink-soft hover:text-brand-ink"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {/* ── OVERVIEW ── */}
      {tab === "overview" && (
        <div className="space-y-3 sm:space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-2 sm:gap-3">
            <Kpi label="Revenue" value={formatINR(revenue)} delta={deltaPct(revenue, prevRevenue)} spark={revenueSeries} />
            <Kpi label="Orders" value={orderCount.toLocaleString("en-IN")} delta={deltaPct(orderCount, prevOrders)} />
            <Kpi
              label="Conversion"
              value={`${conv.toFixed(conv < 10 ? 1 : 0)}%`}
              deltaPp={activeV > 0 && prevVisitors > 0 ? conv - prevConv : null}
            />
            <Kpi label="Avg order value" value={formatINR(aov)} delta={deltaPct(aov, prevAov)} />
            <Kpi label="New customers" value={newCustomersWindow.toLocaleString("en-IN")} delta={deltaPct(newCustomersWindow, prevNewCustomers)} />
          </div>

          <RevenueChart points={chartPoints} />

          {/* Sales breakdown */}
          <div className="grid lg:grid-cols-2 gap-3 sm:gap-4">
            <Card title="Top products" hint="By revenue in this period">
              {bestSellers.length === 0 ? (
                <Empty>No paid orders in this period.</Empty>
              ) : (
                <ul className="divide-y divide-brand-line">
                  {bestSellers.slice(0, 5).map((s, i) => (
                    <li key={s.skuId} className="flex items-center gap-3 px-4 sm:px-5 py-3">
                      <span className="w-4 text-xs font-bold tabular-nums text-brand-ink-soft">{i + 1}</span>
                      <span className="h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-brand-line bg-brand-cream grid place-items-center">
                        {HERO.get(s.skuId) ? (
                          <Image src={HERO.get(s.skuId)!} alt="" width={40} height={40} className="h-full w-full object-contain" />
                        ) : null}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold text-brand-ink">{s.name}</div>
                        <div className="text-xs text-brand-ink-soft tabular-nums">{s.qty} units sold</div>
                      </div>
                      <span className="tabular-nums text-sm font-semibold text-brand-ink">{formatINR(s.revenue)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <TrafficDonut slices={donutSlices} totalLabel={usePaid ? "paid orders" : "orders"} />
          </div>

          {/* Store funnel — reuses the audited funnel report, unchanged */}
          {funnel && (
            <Card title="Store funnel" hint={`Distinct people · last ${range === 1 ? "24 h" : `${range} days`}`}>
              {!funnel.stages.length || funnel.stages[0].visitors === 0 ? (
                <Empty>No visitors tracked in this period.</Empty>
              ) : (
                <div className="space-y-2 p-3 sm:p-5">
                  {funnel.stages.map((s, i) => {
                    const top = funnel.stages[0].visitors || 1;
                    const w = (s.visitors / top) * 100;
                    return (
                      <div key={s.key} className="flex items-center gap-2 sm:gap-3">
                        <span className="w-24 sm:w-36 shrink-0 truncate text-sm font-medium text-brand-ink">{s.label}</span>
                        <div className="relative h-8 flex-1 overflow-hidden rounded-lg bg-brand-cream">
                          <div
                            className="absolute inset-y-0 left-0 rounded-lg bg-gradient-to-r from-brand-red to-brand-red/65"
                            style={{ width: `${Math.max(w, 2)}%` }}
                          />
                        </div>
                        <span className="w-12 sm:w-16 text-right text-sm font-bold tabular-nums text-brand-ink">
                          {s.visitors.toLocaleString("en-IN")}
                        </span>
                        <span
                          className={`w-11 text-right text-xs font-semibold tabular-nums ${
                            i === 0 ? "text-brand-ink-soft/40" : s.stepPct < 50 ? "text-brand-red" : "text-success"
                          }`}
                        >
                          {i === 0 ? "—" : `${s.stepPct.toFixed(s.stepPct < 10 ? 1 : 0)}%`}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          )}

          {/* Customers snapshot */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
            <Tile label="Visitors" value={activeV.toLocaleString("en-IN")} sub="unique people" />
            <Tile label="Sessions" value={sessions.toLocaleString("en-IN")} sub={`${audience.pageviews.toLocaleString("en-IN")} pageviews`} />
            <Tile label="New visitors" value={newV.toLocaleString("en-IN")} sub={`${returningV.toLocaleString("en-IN")} returning`} />
            <Tile label="Repeat rate" value={`${repeatRate}%`} sub={`${repeatBuyers} of ${buyers} buyers`} />
          </div>
        </div>
      )}

      {/* ── PRODUCTS ── */}
      {tab === "products" && (
        <Card title="Best sellers" hint={`By revenue · last ${range} day${range === 1 ? "" : "s"} · paid only`}>
          {bestSellers.length === 0 ? (
            <Empty>No paid orders in this period.</Empty>
          ) : (
            <ul className="divide-y divide-brand-line">
              {bestSellers.map((s, i) => (
                <li key={s.skuId} className="flex flex-wrap items-center gap-3 px-4 sm:px-5 py-3">
                  <span className="w-4 text-xs font-bold tabular-nums text-brand-ink-soft">{i + 1}</span>
                  <span className="h-11 w-11 shrink-0 overflow-hidden rounded-lg border border-brand-line bg-brand-cream grid place-items-center">
                    {HERO.get(s.skuId) ? (
                      <Image src={HERO.get(s.skuId)!} alt="" width={44} height={44} className="h-full w-full object-contain" />
                    ) : null}
                  </span>
                  <div className="min-w-[8rem] flex-1">
                    <div className="truncate text-sm font-semibold text-brand-ink">{s.name}</div>
                    <div className="text-xs text-brand-ink-soft font-mono">{s.skuId}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-brand-ink-soft">Units</div>
                    <div className="text-sm font-semibold tabular-nums text-brand-ink">{s.qty}</div>
                  </div>
                  <div className="w-24 text-right">
                    <div className="text-xs text-brand-ink-soft">Revenue</div>
                    <div className="text-sm font-semibold tabular-nums text-brand-ink">{formatINR(s.revenue)}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {/* ── CUSTOMERS ── */}
      {tab === "customers" && (
        <div className="space-y-3 sm:space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
            <Tile label="Visitors" value={activeV.toLocaleString("en-IN")} sub="unique people" />
            <Tile label="Sessions" value={sessions.toLocaleString("en-IN")} sub="one per visit" />
            <Tile label="New visitors" value={newV.toLocaleString("en-IN")} sub={`${returningV.toLocaleString("en-IN")} returning`} />
            <Tile label="Repeat purchase rate" value={`${repeatRate}%`} sub={`${repeatBuyers} of ${buyers} buyers`} />
          </div>

          <Card title="New customers" hint="Last 12 weeks, Monday-anchored">
            {weeklyBuckets.every((b) => b.count === 0) ? (
              <Empty>No new customers yet.</Empty>
            ) : (
              <div className="flex items-stretch gap-1 sm:gap-1.5 p-3 sm:p-5 h-40 sm:h-48">
                {weeklyBuckets.map((b) => (
                  <div key={istYmd(b.weekStart)} className="flex flex-1 flex-col items-center gap-1">
                    <span className="text-[10px] tabular-nums text-brand-ink-soft h-3.5">{b.count || ""}</span>
                    {/* flex-1 gives the bar a definite parent height so % resolves */}
                    <div className="flex w-full flex-1 items-end">
                      <div
                        className="w-full rounded-t bg-brand-red/80"
                        style={{ height: `${Math.max(2, (b.count / maxWeekly) * 100)}%` }}
                        title={`${b.count} new customers`}
                      />
                    </div>
                    <span className="text-[9px] tabular-nums text-brand-ink-soft">{istShortDate(b.weekStart)}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card title="Repeat cohort" hint="All-time, by lifetime order count">
            <div className="grid grid-cols-3 divide-x divide-brand-line">
              <Split label="1 order" value={cohort?.one ?? 0} />
              <Split label="2 orders" value={cohort?.two ?? 0} />
              <Split label="3+ orders" value={cohort?.threePlus ?? 0} />
            </div>
          </Card>
        </div>
      )}

      {/* ── MARKETING ── */}
      {tab === "marketing" && (
        <div className="space-y-3 sm:space-y-4">
          <Card title="Channels" hint="Attempts → paid orders → revenue">
            {sourceRows.length === 0 ? (
              <Empty>No attributed orders yet.</Empty>
            ) : (
              <ul className="divide-y divide-brand-line">
                {sourceRows.map((r) => (
                  <li key={r.source ?? "direct"} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 sm:px-5 py-3 text-sm">
                    <span className="min-w-[6rem] flex-1 font-semibold text-brand-ink">{srcLabel(r.source)}</span>
                    <span className="text-brand-ink-soft tabular-nums">{r.attempts} attempts</span>
                    <span className="text-brand-ink tabular-nums font-semibold">{r.paid} paid</span>
                    <span className="w-24 text-right tabular-nums text-brand-ink">{formatINR(r.revenue)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Campaigns" hint="Orders carrying a utm_campaign tag">
            {campaignRows.length === 0 ? (
              <Empty>No campaign-tagged orders yet.</Empty>
            ) : (
              <ul className="divide-y divide-brand-line">
                {campaignRows.map((r, i) => (
                  <li key={i} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 sm:px-5 py-3 text-sm">
                    <span className="min-w-[8rem] flex-1 font-semibold text-brand-ink truncate">{r.campaign}</span>
                    <span className="text-xs text-brand-ink-soft">{srcLabel(r.source)}</span>
                    <span className="tabular-nums text-brand-ink">{r.paid} paid</span>
                    <span className="w-24 text-right tabular-nums text-brand-ink">{formatINR(r.revenue)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}

      {/* ── OPERATIONS ── */}
      {tab === "operations" && (
        <div className="space-y-3 sm:space-y-4">
          <Card title="Order status mix" hint={`All orders placed in the last ${range} day${range === 1 ? "" : "s"}`}>
            {statusTotal === 0 ? (
              <Empty>No orders in this period.</Empty>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-brand-line">
                <Split label="Live" value={liveCount} sub={`${statusPct(liveCount)}%`} tone="success" />
                <Split label="Pending" value={pendingCount} sub={`${statusPct(pendingCount)}%`} tone="gold" />
                <Split label="Failed" value={failedCount} sub={`${statusPct(failedCount)}%`} tone="danger" />
                <Split label="Other" value={otherCount} sub={`${statusPct(otherCount)}%`} />
              </div>
            )}
          </Card>

          <Card title="Payment outcomes" hint="Is the failure rate real declines, abandonment, or ops cancellations?">
            {methodAggs.length === 0 ? (
              <Empty>No payment attempts in this period.</Empty>
            ) : (
              <ul className="divide-y divide-brand-line">
                {methodAggs.map((m) => (
                  <li key={m.method} className="px-4 sm:px-5 py-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-semibold text-brand-ink">{m.method}</span>
                      <span className="text-brand-ink-soft tabular-nums text-xs">{m.attempts} attempts</span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs tabular-nums">
                      <span className="text-success">{m.paid} paid</span>
                      <span className="text-brand-red">{m.failed} failed</span>
                      <span className="text-brand-ink-soft">{m.abandoned} abandoned</span>
                      <span className="text-brand-ink-soft">{m.cancelled} cancelled</span>
                      <span className="text-gold">{m.pending} pending</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <div className="grid md:grid-cols-2 gap-3 sm:gap-4">
            <Card title="COD vs prepaid" hint="Of paid orders">
              {paidSplitTotal === 0 ? (
                <Empty>No paid orders yet.</Empty>
              ) : (
                <div className="p-5 space-y-3">
                  <Bar label="COD" value={codPaid} total={paidSplitTotal} color="bg-gold" />
                  <Bar label="Prepaid" value={prepaidPaid} total={paidSplitTotal} color="bg-success" />
                  <div className="pt-3 border-t border-brand-line text-sm">
                    <span className="text-brand-ink-soft">COD RTO rate: </span>
                    <span className={`font-bold tabular-nums ${codRtoPct !== null && codRtoPct > 15 ? "text-brand-red" : "text-brand-ink"}`}>
                      {codRtoPct === null ? "—" : `${codRtoPct}%`}
                    </span>
                    <span className="text-xs text-brand-ink-soft"> ({codReturned} of {codDispatched} dispatched)</span>
                  </div>
                </div>
              )}
            </Card>

            <Card title="Devices" hint="Non-bot sessions">
              {devTotal === 0 ? (
                <Empty>No sessions tracked yet.</Empty>
              ) : (
                <div className="p-5 space-y-3">
                  <Bar label="Mobile" value={devMobile} total={devTotal} color="bg-brand-red" pct={devPct(devMobile)} />
                  <Bar label="Desktop" value={devDesktop} total={devTotal} color="bg-brand-ink" pct={devPct(devDesktop)} />
                  <Bar label="Tablet" value={devTablet} total={devTotal} color="bg-gold" pct={devPct(devTablet)} />
                </div>
              )}
            </Card>
          </div>

          <Card title="Top states" hint="Paid orders by shipping state">
            {geoRows.length === 0 ? (
              <Empty>No paid orders yet.</Empty>
            ) : (
              <ul className="divide-y divide-brand-line">
                {geoRows.map((g) => (
                  <li key={g.state} className="flex items-center justify-between gap-3 px-4 sm:px-5 py-2.5 text-sm">
                    <span className="text-brand-ink">{g.state}</span>
                    <span className="text-brand-ink-soft tabular-nums">
                      {g.paid} orders · <span className="text-brand-ink font-semibold">{formatINR(g.revenue)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}

/* ── presentational helpers ─────────────────────────────────────────────── */

function Kpi({
  label,
  value,
  delta,
  deltaPp,
  spark,
}: {
  label: string;
  value: string;
  delta?: number | null;
  deltaPp?: number | null;
  spark?: number[];
}) {
  const d = deltaPp ?? delta ?? null;
  const up = d !== null && d >= 0;
  const text =
    d === null
      ? "—"
      : deltaPp !== undefined && deltaPp !== null
        ? `${Math.abs(d).toFixed(1)} pp`
        : `${Math.abs(d).toFixed(1)}%`;

  return (
    <div className="rounded-2xl border border-brand-line bg-white p-3 sm:p-4">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-brand-ink-soft truncate">{label}</div>
      <div className="mt-1.5 text-[20px] font-bold tabular-nums text-brand-ink truncate">{value}</div>
      <div className="mt-1 flex items-center justify-between gap-2">
        <span
          className={`inline-flex items-center gap-0.5 text-[11px] font-semibold tabular-nums ${
            d === null ? "text-brand-ink-soft/60" : up ? "text-success" : "text-brand-red"
          }`}
        >
          {d !== null && (up ? <ArrowUp size={11} /> : <ArrowDown size={11} />)}
          {text}
        </span>
        {spark && spark.length > 1 && <Spark values={spark} />}
      </div>
    </div>
  );
}

/** Tiny server-rendered sparkline (no JS shipped). */
function Spark({ values }: { values: number[] }) {
  const max = Math.max(1, ...values);
  const n = values.length;
  const d = values
    .map((v, i) => `${i === 0 ? "M" : "L"}${(i / (n - 1)) * 56},${16 - (v / max) * 14}`)
    .join(" ");
  return (
    <svg width="56" height="16" viewBox="0 0 56 16" className="shrink-0" aria-hidden>
      <path d={d} fill="none" stroke="var(--success)" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function Card({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-brand-line bg-white overflow-hidden">
      <header className="px-4 sm:px-5 py-3.5 border-b border-brand-line">
        <h2 className="font-semibold text-brand-ink">{title}</h2>
        {hint && <p className="text-xs text-brand-ink-soft mt-0.5">{hint}</p>}
      </header>
      {children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="px-5 py-10 sm:py-14 text-center text-sm text-brand-ink-soft">{children}</p>;
}

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-brand-line bg-white p-3 sm:p-4">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-brand-ink-soft">
        <Users size={12} /> {label}
      </div>
      <div className="mt-1.5 text-xl font-bold tabular-nums text-brand-ink">{value}</div>
      {sub && <div className="text-[11px] text-brand-ink-soft mt-0.5 tabular-nums">{sub}</div>}
    </div>
  );
}

function Split({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: number;
  sub?: string;
  tone?: "success" | "gold" | "danger";
}) {
  const color =
    tone === "success" ? "text-success" : tone === "gold" ? "text-gold" : tone === "danger" ? "text-brand-red" : "text-brand-ink";
  return (
    <div className="px-3 py-3 sm:px-5 sm:py-4 text-center">
      <div className={`text-xl sm:text-2xl font-bold tabular-nums ${color}`}>{value.toLocaleString("en-IN")}</div>
      <div className="text-xs text-brand-ink-soft mt-0.5">{label}</div>
      {sub && <div className="text-[11px] text-brand-ink-soft tabular-nums">{sub}</div>}
    </div>
  );
}

function Bar({
  label,
  value,
  total,
  color,
  pct,
}: {
  label: string;
  value: number;
  total: number;
  color: string;
  pct?: number;
}) {
  const p = pct ?? (total === 0 ? 0 : Math.round((value / total) * 100));
  return (
    <div>
      <div className="flex items-center justify-between text-sm mb-1.5">
        <span className="text-brand-ink">{label}</span>
        <span className="text-brand-ink-soft tabular-nums">
          {value.toLocaleString("en-IN")} <span className="font-semibold text-brand-ink">({p}%)</span>
        </span>
      </div>
      <div className="h-2 rounded-full bg-brand-cream overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.max(2, p)}%` }} />
      </div>
    </div>
  );
}
