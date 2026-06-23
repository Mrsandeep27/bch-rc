import { and, count, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { BarChart3, PackageCheck, Repeat, CreditCard, Smartphone, MapPin } from "lucide-react";
import { db } from "@/db";
import { analyticsSessions, customers, orders } from "@/db/schema";
import { requireAdmin } from "@/lib/admin-auth";
import { formatINR } from "@/lib/utils";

// Orders we treat as "real revenue" for analytics. Excludes PENDING and the
// failed bucket so the trend chart reflects what actually banked.
const PAID_STATUSES = ["PAID", "PACKED", "SHIPPED", "DELIVERED"] as const;
const FAILED_STATUSES = [
  "CANCELLED",
  "FAILED",
  "ABANDONED",
  "RETURNED",
  "REFUNDED",
] as const;

type OrderItemForAgg = {
  skuId: string;
  name?: string;
  qty: number;
  lineTotalInr: number;
};

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function shortDate(d: Date): string {
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

export default async function AdminAnalytics() {
  const ctx = await requireAdmin();

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const last30 = new Date(today);
  last30.setDate(last30.getDate() - 29); // inclusive of today → 30 buckets

  // 12 weekly buckets, Monday-anchored. Start = Monday of the week 11 weeks ago.
  const last12Weeks = new Date(today);
  const dow = (last12Weeks.getDay() + 6) % 7; // Mon=0, Sun=6
  last12Weeks.setDate(last12Weeks.getDate() - dow - 11 * 7);

  // Five aggregates in parallel. Daily revenue uses a DATE_TRUNC bucketing
  // query for accuracy; the rest are straightforward GROUP BYs.
  // Paid-order filter as a reusable SQL fragment for the attribution rollups.
  const paidFilter = sql`${orders.status} in ('PAID','PACKED','SHIPPED','DELIVERED')`;

  const [
    dailyRevenueRows,
    paidVsFailedRows,
    paidOrdersForSku,
    weeklyCustomerRows,
    total30dStats,
    sourceRows,
    campaignRows,
    paymentOutcomeRows,
    geoRows,
    deviceStats,
  ] = await Promise.all([
      db
        .select({
          day: sql<string>`to_char(date_trunc('day', ${orders.placedAt}), 'YYYY-MM-DD')`,
          revenue: sql<number>`coalesce(sum(${orders.totalInr}), 0)::int`,
          orderCount: sql<number>`count(*)::int`,
        })
        .from(orders)
        .where(
          and(
            gte(orders.placedAt, last30),
            inArray(orders.siteId, ctx.siteIds),
            inArray(orders.status, [...PAID_STATUSES]),
          ),
        )
        .groupBy(sql`date_trunc('day', ${orders.placedAt})`)
        .orderBy(sql`date_trunc('day', ${orders.placedAt})`),
      db
        .select({
          status: orders.status,
          count: sql<number>`count(*)::int`,
        })
        .from(orders)
        .where(
          and(gte(orders.placedAt, last30), inArray(orders.siteId, ctx.siteIds)),
        )
        .groupBy(orders.status),
      db
        .select({ items: orders.items })
        .from(orders)
        .where(
          and(
            gte(orders.placedAt, last30),
            inArray(orders.siteId, ctx.siteIds),
            inArray(orders.status, [...PAID_STATUSES]),
          ),
        ),
      db
        .select({
          week: sql<string>`to_char(date_trunc('week', ${customers.createdAt}), 'YYYY-MM-DD')`,
          count: sql<number>`count(*)::int`,
        })
        .from(customers)
        .where(gte(customers.createdAt, last12Weeks))
        .groupBy(sql`date_trunc('week', ${customers.createdAt})`)
        .orderBy(sql`date_trunc('week', ${customers.createdAt})`),
      db
        .select({
          orderCount: count(orders.id),
          revenue: sql<number>`coalesce(sum(${orders.totalInr}), 0)::int`,
        })
        .from(orders)
        .where(
          and(
            gte(orders.placedAt, last30),
            inArray(orders.siteId, ctx.siteIds),
            inArray(orders.status, [...PAID_STATUSES]),
          ),
        )
        .then((rows) => rows[0]),
      // Attribution by source — attempts vs paid vs revenue per channel. This
      // is the "paid orders per channel" view, not just clicks.
      db
        .select({
          source: orders.source,
          attempts: sql<number>`count(*)::int`,
          paid: sql<number>`count(*) filter (where ${paidFilter})::int`,
          revenue: sql<number>`coalesce(sum(${orders.totalInr}) filter (where ${paidFilter}), 0)::int`,
        })
        .from(orders)
        .where(
          and(gte(orders.placedAt, last30), inArray(orders.siteId, ctx.siteIds)),
        )
        .groupBy(orders.source)
        .orderBy(desc(sql`count(*) filter (where ${paidFilter})`)),
      // Top campaigns — only orders that carried a utm_campaign tag.
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
            gte(orders.placedAt, last30),
            inArray(orders.siteId, ctx.siteIds),
            sql`${orders.utmCampaign} is not null`,
          ),
        )
        .groupBy(orders.utmCampaign, orders.source)
        .orderBy(desc(sql`count(*) filter (where ${paidFilter})`))
        .limit(10),
      // Payment outcome by method — every method × status cell. Drives the
      // "is it really 70% payment failure?" answer + COD/prepaid split + RTO.
      db
        .select({
          method: orders.paymentMethod,
          status: orders.status,
          count: sql<number>`count(*)::int`,
        })
        .from(orders)
        .where(
          and(gte(orders.placedAt, last30), inArray(orders.siteId, ctx.siteIds)),
        )
        .groupBy(orders.paymentMethod, orders.status),
      // Geography — paid orders by state (top 8).
      db
        .select({
          state: sql<string>`coalesce(nullif(${orders.shippingAddress}->>'state', ''), 'Unknown')`,
          paid: sql<number>`count(*)::int`,
          revenue: sql<number>`coalesce(sum(${orders.totalInr}), 0)::int`,
        })
        .from(orders)
        .where(
          and(
            gte(orders.placedAt, last30),
            inArray(orders.siteId, ctx.siteIds),
            inArray(orders.status, [...PAID_STATUSES]),
          ),
        )
        .groupBy(sql`coalesce(nullif(${orders.shippingAddress}->>'state', ''), 'Unknown')`)
        .orderBy(desc(sql`count(*)`))
        .limit(8),
      // Device split of real (non-bot) sessions, last 30 days. Tablet tested
      // before mobile because iPad UAs also contain "Mobile".
      db
        .select({
          total: sql<number>`count(*)::int`,
          tablet: sql<number>`count(*) filter (where ${analyticsSessions.userAgent} ~* 'ipad|tablet|playbook|silk')::int`,
          mobile: sql<number>`count(*) filter (where ${analyticsSessions.userAgent} ~* 'mobi|iphone|ipod|android.*mobile|windows phone|blackberry' and ${analyticsSessions.userAgent} !~* 'ipad|tablet|playbook|silk')::int`,
        })
        .from(analyticsSessions)
        .where(
          and(
            gte(analyticsSessions.startedAt, last30),
            inArray(analyticsSessions.siteId, ctx.siteIds),
            eq(analyticsSessions.isBot, false),
          ),
        )
        .then((rows) => rows[0]),
    ]);

  // -------------------------------------------------------------------------
  // Daily revenue — pad missing days with zero so the chart shows continuity
  // even if there were no orders on some days. Postgres only returns rows
  // for days that had orders.
  // -------------------------------------------------------------------------
  const daysMap = new Map(
    dailyRevenueRows.map((r) => [r.day, { revenue: r.revenue, orderCount: r.orderCount }]),
  );
  const dailyBuckets: Array<{
    date: Date;
    revenue: number;
    orderCount: number;
  }> = [];
  for (let i = 0; i < 30; i++) {
    const d = new Date(last30);
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

  // -------------------------------------------------------------------------
  // Status mix
  // -------------------------------------------------------------------------
  let liveCount = 0;
  let pendingCount = 0;
  let failedCount = 0;
  for (const row of paidVsFailedRows) {
    if ((PAID_STATUSES as readonly string[]).includes(row.status))
      liveCount += row.count;
    else if (row.status === "PENDING") pendingCount += row.count;
    else if ((FAILED_STATUSES as readonly string[]).includes(row.status))
      failedCount += row.count;
  }
  const statusTotal = liveCount + pendingCount + failedCount;
  const pct = (n: number) =>
    statusTotal === 0 ? 0 : Math.round((n / statusTotal) * 100);

  // -------------------------------------------------------------------------
  // Best sellers — same in-process aggregation pattern as the dashboard.
  // -------------------------------------------------------------------------
  const skuAggregate = new Map<
    string,
    { name: string; qty: number; revenue: number }
  >();
  for (const row of paidOrdersForSku) {
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
  const bestSellers = Array.from(skuAggregate.entries())
    .map(([skuId, v]) => ({ skuId, ...v }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);

  // -------------------------------------------------------------------------
  // Weekly new customers — pad missing weeks the same way as daily revenue.
  // -------------------------------------------------------------------------
  const weeklyMap = new Map(weeklyCustomerRows.map((r) => [r.week, r.count]));
  const weeklyBuckets: Array<{ weekStart: Date; count: number }> = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(last12Weeks);
    d.setDate(d.getDate() + i * 7);
    const key = ymd(d);
    weeklyBuckets.push({ weekStart: d, count: weeklyMap.get(key) ?? 0 });
  }
  const maxWeekly = Math.max(1, ...weeklyBuckets.map((b) => b.count));

  // -------------------------------------------------------------------------
  // Payment outcome by method — the report that decides whether the failure
  // problem is real declines, abandonment, or ops-cancellations.
  // -------------------------------------------------------------------------
  const PAID_SET = new Set<string>(PAID_STATUSES);
  type MethodAgg = {
    method: string;
    attempts: number;
    paid: number;
    failed: number;
    abandoned: number;
    cancelled: number;
    pending: number;
  };
  const methodMap = new Map<string, MethodAgg>();
  for (const r of paymentOutcomeRows) {
    const m = methodMap.get(r.method) ?? {
      method: r.method,
      attempts: 0,
      paid: 0,
      failed: 0,
      abandoned: 0,
      cancelled: 0,
      pending: 0,
    };
    m.attempts += r.count;
    if (PAID_SET.has(r.status)) m.paid += r.count;
    else if (r.status === "FAILED") m.failed += r.count;
    else if (r.status === "ABANDONED") m.abandoned += r.count;
    else if (r.status === "CANCELLED") m.cancelled += r.count;
    else if (r.status === "PENDING" || r.status === "PENDING_COD_VERIFICATION")
      m.pending += r.count;
    methodMap.set(r.method, m);
  }
  const methodAggs = Array.from(methodMap.values()).sort(
    (a, b) => b.attempts - a.attempts,
  );

  // COD vs prepaid split (of paid orders) + COD RTO rate.
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
    if (["SHIPPED", "DELIVERED", "RETURNED"].includes(r.status))
      codDispatched += r.count;
    if (r.status === "RETURNED") codReturned += r.count;
  }
  const codRtoPct =
    codDispatched > 0 ? Math.round((codReturned / codDispatched) * 100) : null;

  // Device split of real sessions.
  const devTotal = deviceStats?.total ?? 0;
  const devMobile = deviceStats?.mobile ?? 0;
  const devTablet = deviceStats?.tablet ?? 0;
  const devDesktop = Math.max(0, devTotal - devMobile - devTablet);
  const devPct = (n: number) =>
    devTotal === 0 ? 0 : Math.round((n / devTotal) * 100);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-brand-ink">
          Analytics
        </h1>
        <p className="text-sm text-brand-ink-soft mt-1">
          30-day revenue, best sellers, and customer acquisition.
          Excludes pending UPI carts.
        </p>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <SummaryCard
          label="Paid orders (30d)"
          value={total30dStats?.orderCount ?? 0}
          icon={PackageCheck}
        />
        <SummaryCard
          label="Revenue (30d)"
          value={formatINR(total30dStats?.revenue ?? 0)}
          icon={BarChart3}
        />
        <SummaryCard
          label="Failed orders (30d)"
          value={failedCount}
          icon={Repeat}
          danger={failedCount > 0}
        />
      </div>

      {/* Daily revenue — horizontal bars */}
      <section className="bg-white rounded-2xl border border-brand-line">
        <header className="px-5 py-4 border-b border-brand-line">
          <h2 className="font-semibold text-brand-ink">
            Daily revenue <span className="text-brand-ink-soft font-normal">— last 30 days</span>
          </h2>
        </header>
        <div className="p-5 space-y-1.5">
          {dailyBuckets.map((b) => {
            const isToday = ymd(b.date) === ymd(today);
            const width = `${Math.max(2, (b.revenue / maxRevenue) * 100)}%`;
            return (
              <div
                key={ymd(b.date)}
                className="grid grid-cols-[52px_1fr_auto] sm:grid-cols-[80px_1fr_120px] items-center gap-2 sm:gap-3 text-xs"
              >
                <span
                  className={`tabular-nums ${
                    isToday ? "text-brand-red font-semibold" : "text-brand-ink-soft"
                  }`}
                >
                  {shortDate(b.date)}
                </span>
                <div className="bg-brand-cream rounded-md h-5 overflow-hidden">
                  <div
                    className={`${
                      b.revenue === 0
                        ? "bg-transparent"
                        : isToday
                          ? "bg-brand-red"
                          : "bg-brand-ink"
                    } h-full transition-all`}
                    style={{ width }}
                  />
                </div>
                <span className="tabular-nums text-right text-brand-ink-soft">
                  {b.revenue > 0 ? (
                    <>
                      <span className="font-semibold text-brand-ink">
                        {formatINR(b.revenue)}
                      </span>
                      <span className="text-brand-ink-soft ml-1">
                        ({b.orderCount})
                      </span>
                    </>
                  ) : (
                    "—"
                  )}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      {/* Status mix */}
      <section className="bg-white rounded-2xl border border-brand-line p-5">
        <header className="mb-4">
          <h2 className="font-semibold text-brand-ink">
            Status mix <span className="text-brand-ink-soft font-normal">— last 30 days</span>
          </h2>
          <p className="text-xs text-brand-ink-soft mt-1">
            Healthy stores keep failed % under 5%.
          </p>
        </header>
        {statusTotal === 0 ? (
          <p className="text-sm text-brand-ink-soft py-6 text-center">
            No orders in the last 30 days.
          </p>
        ) : (
          <>
            <div className="flex h-3 rounded-full overflow-hidden bg-brand-cream mb-4">
              <div
                className="bg-success"
                style={{ width: `${pct(liveCount)}%` }}
                title={`Live ${pct(liveCount)}%`}
              />
              <div
                className="bg-gold"
                style={{ width: `${pct(pendingCount)}%` }}
                title={`Pending ${pct(pendingCount)}%`}
              />
              <div
                className="bg-brand-red"
                style={{ width: `${pct(failedCount)}%` }}
                title={`Failed ${pct(failedCount)}%`}
              />
            </div>
            <div className="grid grid-cols-3 gap-3 text-xs">
              <MixLegend
                color="bg-success"
                label="Live"
                count={liveCount}
                pct={pct(liveCount)}
              />
              <MixLegend
                color="bg-gold"
                label="Pending"
                count={pendingCount}
                pct={pct(pendingCount)}
              />
              <MixLegend
                color="bg-brand-red"
                label="Failed"
                count={failedCount}
                pct={pct(failedCount)}
              />
            </div>
          </>
        )}
      </section>

      {/* Attribution — paid orders & revenue by channel */}
      <section className="bg-white rounded-2xl border border-brand-line">
        <header className="px-5 py-4 border-b border-brand-line">
          <h2 className="font-semibold text-brand-ink">
            Where paid orders come from{" "}
            <span className="text-brand-ink-soft font-normal">
              — last 30 days, by source
            </span>
          </h2>
          <p className="text-xs text-brand-ink-soft mt-1">
            First-touch attribution snapshotted on each order. Tag your content
            links with UTMs so &quot;social&quot; splits into the actual reel /
            post. Bare links land in <span className="font-mono">direct</span>.
          </p>
        </header>
        {sourceRows.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-brand-ink-soft">
            No orders in the last 30 days yet.
          </p>
        ) : (
          <ul className="divide-y divide-brand-line">
            {sourceRows.map((r) => {
              const conv =
                r.attempts > 0 ? Math.round((r.paid / r.attempts) * 100) : 0;
              return (
                <li
                  key={r.source}
                  className="flex items-center gap-4 px-5 py-3 text-sm"
                >
                  <span className="font-semibold text-brand-ink capitalize w-24 shrink-0">
                    {r.source}
                  </span>
                  <span className="text-brand-ink-soft tabular-nums flex-1">
                    {r.paid} paid{" "}
                    <span className="text-brand-ink-soft/70">
                      / {r.attempts} attempts ({conv}%)
                    </span>
                  </span>
                  <span className="font-semibold text-brand-ink tabular-nums text-right shrink-0">
                    {formatINR(r.revenue)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
        {campaignRows.length > 0 && (
          <div className="border-t border-brand-line px-5 py-4">
            <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-brand-ink-soft mb-3">
              Top campaigns
            </h3>
            <ul className="space-y-2">
              {campaignRows.map((c) => (
                <li
                  key={`${c.campaign}-${c.source}`}
                  className="flex items-center gap-3 text-sm"
                >
                  <span className="font-mono text-brand-ink truncate flex-1">
                    {c.campaign}
                    <span className="text-brand-ink-soft ml-2">/ {c.source}</span>
                  </span>
                  <span className="text-brand-ink-soft tabular-nums shrink-0">
                    {c.paid} paid
                  </span>
                  <span className="font-semibold text-brand-ink tabular-nums text-right w-20 shrink-0">
                    {formatINR(c.revenue)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* Payment outcome by method — the real failure story */}
      <section className="bg-white rounded-2xl border border-brand-line">
        <header className="px-5 py-4 border-b border-brand-line">
          <h2 className="font-semibold text-brand-ink flex items-center gap-2">
            <CreditCard size={16} className="text-brand-red" /> Payment outcome
            by method{" "}
            <span className="text-brand-ink-soft font-normal">— 30 days</span>
          </h2>
          <p className="text-xs text-brand-ink-soft mt-1">
            Splits the &quot;failed&quot; lump into real declines vs abandoned
            carts vs cancellations — so you fix the right thing.{" "}
            <span className="font-mono">paid</span> = completed,{" "}
            <span className="font-mono">failed</span> = declined,{" "}
            <span className="font-mono">aband.</span> = never paid,{" "}
            <span className="font-mono">canc.</span> = cancelled.
          </p>
        </header>
        {methodAggs.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-brand-ink-soft">
            No orders in the last 30 days yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] font-mono uppercase tracking-wider text-brand-ink-soft border-b border-brand-line">
                  <th className="text-left px-5 py-2 font-semibold">Method</th>
                  <th className="text-right px-3 py-2 font-semibold">Attempts</th>
                  <th className="text-right px-3 py-2 font-semibold">Paid</th>
                  <th className="text-right px-3 py-2 font-semibold">Failed</th>
                  <th className="text-right px-3 py-2 font-semibold">Aband.</th>
                  <th className="text-right px-5 py-2 font-semibold">Canc.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-line">
                {methodAggs.map((m) => {
                  const conv =
                    m.attempts > 0
                      ? Math.round((m.paid / m.attempts) * 100)
                      : 0;
                  return (
                    <tr key={m.method}>
                      <td className="px-5 py-2.5 font-semibold text-brand-ink">
                        {m.method}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-brand-ink-soft">
                        {m.attempts}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-brand-ink">
                        {m.paid}{" "}
                        <span className="text-brand-ink-soft font-normal">
                          ({conv}%)
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-brand-red">
                        {m.failed || "—"}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-brand-ink-soft">
                        {m.abandoned || "—"}
                      </td>
                      <td className="px-5 py-2.5 text-right tabular-nums text-brand-ink-soft">
                        {m.cancelled || "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Audience snapshot — device, COD/prepaid, RTO */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Device split */}
        <section className="bg-white rounded-2xl border border-brand-line p-5">
          <h2 className="font-semibold text-brand-ink flex items-center gap-2 mb-3">
            <Smartphone size={15} className="text-brand-red" /> Device
          </h2>
          {devTotal === 0 ? (
            <p className="text-sm text-brand-ink-soft">No sessions yet.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              <DeviceRow label="Mobile" count={devMobile} pct={devPct(devMobile)} />
              <DeviceRow label="Desktop" count={devDesktop} pct={devPct(devDesktop)} />
              <DeviceRow label="Tablet" count={devTablet} pct={devPct(devTablet)} />
            </ul>
          )}
        </section>

        {/* COD vs prepaid */}
        <section className="bg-white rounded-2xl border border-brand-line p-5">
          <h2 className="font-semibold text-brand-ink flex items-center gap-2 mb-3">
            <CreditCard size={15} className="text-brand-red" /> COD vs prepaid
          </h2>
          {paidSplitTotal === 0 ? (
            <p className="text-sm text-brand-ink-soft">No paid orders yet.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              <DeviceRow
                label="Prepaid"
                count={prepaidPaid}
                pct={Math.round((prepaidPaid / paidSplitTotal) * 100)}
              />
              <DeviceRow
                label="COD"
                count={codPaid}
                pct={Math.round((codPaid / paidSplitTotal) * 100)}
              />
            </ul>
          )}
        </section>

        {/* COD RTO */}
        <section className="bg-white rounded-2xl border border-brand-line p-5">
          <h2 className="font-semibold text-brand-ink flex items-center gap-2 mb-3">
            <Repeat size={15} className="text-brand-red" /> COD RTO rate
          </h2>
          {codRtoPct === null ? (
            <p className="text-sm text-brand-ink-soft">
              No COD parcels dispatched yet.
            </p>
          ) : (
            <>
              <p
                className={`font-display text-3xl font-bold ${
                  codRtoPct > 25 ? "text-brand-red" : "text-brand-ink"
                }`}
              >
                {codRtoPct}%
              </p>
              <p className="text-xs text-brand-ink-soft mt-1">
                {codReturned} returned of {codDispatched} COD dispatched. A
                return costs ~2× freight.
              </p>
            </>
          )}
        </section>
      </div>

      {/* Geography */}
      <section className="bg-white rounded-2xl border border-brand-line">
        <header className="px-5 py-4 border-b border-brand-line">
          <h2 className="font-semibold text-brand-ink flex items-center gap-2">
            <MapPin size={16} className="text-brand-red" /> Top states{" "}
            <span className="text-brand-ink-soft font-normal">
              — paid orders, 30 days
            </span>
          </h2>
        </header>
        {geoRows.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-brand-ink-soft">
            No paid orders in the last 30 days yet.
          </p>
        ) : (
          <ul className="divide-y divide-brand-line">
            {geoRows.map((g) => (
              <li
                key={g.state}
                className="flex items-center gap-4 px-5 py-3 text-sm"
              >
                <span className="font-semibold text-brand-ink flex-1 truncate">
                  {g.state}
                </span>
                <span className="text-brand-ink-soft tabular-nums shrink-0">
                  {g.paid} order{g.paid === 1 ? "" : "s"}
                </span>
                <span className="font-semibold text-brand-ink tabular-nums text-right w-24 shrink-0">
                  {formatINR(g.revenue)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Best sellers */}
      <section className="bg-white rounded-2xl border border-brand-line">
        <header className="px-5 py-4 border-b border-brand-line">
          <h2 className="font-semibold text-brand-ink">
            Best sellers <span className="text-brand-ink-soft font-normal">— last 30 days, by revenue</span>
          </h2>
        </header>
        {bestSellers.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-brand-ink-soft">
            No paid orders in the last 30 days yet.
          </p>
        ) : (
          <ul className="divide-y divide-brand-line">
            {bestSellers.map((s, i) => (
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
                    {formatINR(s.revenue)}
                  </div>
                  <div className="text-xs text-brand-ink-soft tabular-nums mt-0.5">
                    {s.qty} sold
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* New customers per week */}
      <section className="bg-white rounded-2xl border border-brand-line">
        <header className="px-5 py-4 border-b border-brand-line">
          <h2 className="font-semibold text-brand-ink">
            New customers <span className="text-brand-ink-soft font-normal">— last 12 weeks</span>
          </h2>
        </header>
        <div className="p-5 grid grid-cols-12 gap-2 items-end h-40">
          {weeklyBuckets.map((b) => {
            const height = `${Math.max(2, (b.count / maxWeekly) * 100)}%`;
            return (
              <div
                key={ymd(b.weekStart)}
                className="flex flex-col items-center gap-1.5 h-full"
              >
                <div
                  className="w-full flex-1 flex items-end"
                  title={`${b.count} new in week of ${shortDate(b.weekStart)}`}
                >
                  <div
                    className={`w-full rounded-t ${b.count > 0 ? "bg-brand-ink" : "bg-brand-line"}`}
                    style={{ height }}
                  />
                </div>
                <span className="text-[9px] font-mono text-brand-ink-soft truncate w-full text-center">
                  {shortDate(b.weekStart)}
                </span>
                <span className="text-[10px] tabular-nums font-semibold text-brand-ink">
                  {b.count}
                </span>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  icon: Icon,
  danger,
}: {
  label: string;
  value: number | string;
  icon: React.ComponentType<{ size?: number }>;
  danger?: boolean;
}) {
  return (
    <div
      className={`bg-white rounded-2xl border p-5 ${
        danger ? "border-brand-red/40" : "border-brand-line"
      }`}
    >
      <div className="flex items-center justify-between">
        <p className="text-xs font-mono font-bold uppercase tracking-widest text-brand-ink-soft">
          {label}
        </p>
        <Icon size={16} />
      </div>
      <p
        className={`font-display text-3xl font-bold mt-2 ${
          danger ? "text-brand-red" : "text-brand-ink"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function DeviceRow({
  label,
  count,
  pct,
}: {
  label: string;
  count: number;
  pct: number;
}) {
  return (
    <li>
      <div className="flex items-center justify-between mb-1">
        <span className="text-brand-ink-soft">{label}</span>
        <span className="tabular-nums font-semibold text-brand-ink">
          {pct}% <span className="text-brand-ink-soft font-normal">({count})</span>
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-brand-cream overflow-hidden">
        <div className="h-full bg-brand-ink" style={{ width: `${pct}%` }} />
      </div>
    </li>
  );
}

function MixLegend({
  color,
  label,
  count,
  pct,
}: {
  color: string;
  label: string;
  count: number;
  pct: number;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className={`w-3 h-3 rounded ${color}`} />
      <span className="text-brand-ink-soft">{label}</span>
      <span className="tabular-nums font-semibold text-brand-ink ml-auto">
        {count} <span className="text-brand-ink-soft font-normal">({pct}%)</span>
      </span>
    </div>
  );
}

