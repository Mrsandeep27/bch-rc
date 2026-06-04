import { and, count, desc, gte, inArray, sql } from "drizzle-orm";
import { BarChart3, PackageCheck, Repeat } from "lucide-react";
import { db } from "@/db";
import { customers, orders } from "@/db/schema";
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
  const [dailyRevenueRows, paidVsFailedRows, paidOrdersForSku, weeklyCustomerRows, total30dStats] =
    await Promise.all([
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

