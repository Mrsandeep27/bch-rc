import Link from "next/link";
import {
  AlertTriangle,
  ArrowUpRight,
  IndianRupee,
  Package,
  Repeat,
  TrendingUp,
  Users,
} from "lucide-react";
import { desc, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { orders } from "@/db/schema";
import { requireAdmin } from "@/lib/admin-auth";
import { formatINR } from "@/lib/utils";

// SKUs sold below this stock-count threshold appear in the Low-Stock card.
// Tuned to the operator's lead time from Syed (≈48 hrs to top up).
const LOW_STOCK_THRESHOLD = 10;

// Orders we consider "paid" for AOV + top-SKU aggregates. Excludes PENDING
// (UPI carts that never captured) and anything terminal-unhappy.
const PAID_STATUSES = [
  "PAID",
  "PACKED",
  "SHIPPED",
  "DELIVERED",
] as const;

type OrderItemForAgg = {
  skuId: string;
  name?: string;
  qty: number;
  lineTotalInr: number;
};

export default async function AdminOverview() {
  const ctx = await requireAdmin();

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const last7 = new Date(today);
  last7.setDate(last7.getDate() - 7);
  const last30 = new Date(today);
  last30.setDate(last30.getDate() - 30);

  // Three round-trips instead of eight. The first two queries use FILTER
  // clauses to fold what used to be five separate aggregates into single
  // SQL statements — Postgres scans the relevant rows once, computes every
  // counter on that pass. Wall-clock collapses from ~5-batch sequential
  // (max:3 pool) to a single batch.
  //
  // Each query has a defensive try/catch with safe defaults so the dashboard
  // renders even if one section's query times out — an empty Top-SKUs panel
  // beats a stuck skeleton.
  const paidIn = sql.raw(
    `('${PAID_STATUSES.join("','")}')`,
  ); // safe — no user input, constant tuple
  const siteIdsLiteral = sql.raw(
    `ARRAY[${ctx.siteIds.map((s) => `'${s.replace(/'/g, "''")}'`).join(",")}]::text[]`,
  );

  const [orderAggRow, customerAggRow, topSkuOrders, recent] = await Promise.all(
    [
      // Combined orders aggregate: today / 7d / 7d-paid + low-stock count
      // co-tenant in the same trip (inventory join would be expensive — keep
      // separate). Returns one row.
      db
        .execute(
          sql`
        SELECT
          count(*) filter (where placed_at >= ${today})::int as today_count,
          coalesce(sum(total_inr) filter (where placed_at >= ${today}), 0)::int as today_revenue,
          count(*) filter (where placed_at >= ${last7})::int as week_count,
          coalesce(sum(total_inr) filter (where placed_at >= ${last7}), 0)::int as week_revenue,
          count(*) filter (
            where placed_at >= ${last7}
            and status in ${paidIn}
          )::int as week_paid_count,
          coalesce(sum(total_inr) filter (
            where placed_at >= ${last7}
            and status in ${paidIn}
          ), 0)::int as week_paid_revenue
        FROM orders
        WHERE site_id = ANY(${siteIdsLiteral})
      `,
        )
        .then((res) => (res as unknown as { rows?: Record<string, number>[] }).rows?.[0] ?? null)
        .catch(() => null),

      // Customers (returning + total) + low-stock count combined.
      db
        .execute(
          sql`
        SELECT
          (SELECT count(*)::int FROM customers) as total_customers,
          (SELECT count(*) filter (where total_orders > 1)::int FROM customers) as returning_customers,
          (
            SELECT count(*)::int FROM inventory
            WHERE site_id = ANY(${siteIdsLiteral})
              AND stock < ${LOW_STOCK_THRESHOLD}
          ) as low_stock_count
      `,
        )
        .then((res) => (res as unknown as { rows?: Record<string, number>[] }).rows?.[0] ?? null)
        .catch(() => null),

      // Top SKUs — capped at last 100 paid orders. More than enough for a
      // top-5 ranking; reduces JSONB payload size on cold-start by an order
      // of magnitude when there's a long history.
      db
        .select({ items: orders.items })
        .from(orders)
        .where(
          sql`placed_at >= ${last30} AND site_id = ANY(${siteIdsLiteral}) AND status IN ${paidIn}`,
        )
        .orderBy(desc(orders.placedAt))
        .limit(100)
        .catch(() => [] as Array<{ items: unknown }>),

      db
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
        .limit(8)
        .catch(() => [] as Array<{
          id: string;
          siteId: string;
          status: string;
          paymentMethod: string;
          totalInr: number;
          placedAt: Date;
        }>),
    ],
  );

  const todayStats = {
    orderCount: orderAggRow?.today_count ?? 0,
    revenue: orderAggRow?.today_revenue ?? 0,
  };
  const weekStats = {
    orderCount: orderAggRow?.week_count ?? 0,
    revenue: orderAggRow?.week_revenue ?? 0,
  };
  const aovStats = {
    orderCount: orderAggRow?.week_paid_count ?? 0,
    revenue: orderAggRow?.week_paid_revenue ?? 0,
  };
  const customerStats = { total: customerAggRow?.total_customers ?? 0 };
  const returningStats = {
    returning: customerAggRow?.returning_customers ?? 0,
    total: customerAggRow?.total_customers ?? 0,
  };
  const lowStockStats = { count: customerAggRow?.low_stock_count ?? 0 };

  const aov =
    aovStats?.orderCount && aovStats.orderCount > 0
      ? Math.round((aovStats.revenue ?? 0) / aovStats.orderCount)
      : 0;

  const returningPct =
    returningStats?.total && returningStats.total > 0
      ? Math.round(((returningStats.returning ?? 0) / returningStats.total) * 100)
      : 0;

  // Aggregate top SKUs by qty (volume) — the operator's restock signal.
  // Tie-break by revenue so a ₹1,899 SKU outranks a ₹16 QA SKU at the
  // same qty.
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
    .sort((a, b) => (b.qty - a.qty) || (b.revenue - a.revenue))
    .slice(0, 5);

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
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="Today"
          value={todayStats?.orderCount ?? 0}
          sub={`${formatINR(todayStats?.revenue ?? 0)} revenue`}
          icon={Package}
        />
        <StatCard
          label="Last 7 days"
          value={weekStats?.orderCount ?? 0}
          sub={`${formatINR(weekStats?.revenue ?? 0)} revenue`}
          icon={IndianRupee}
        />
        <StatCard
          label="AOV (7d, paid)"
          value={formatINR(aov)}
          sub={
            aovStats?.orderCount
              ? `Across ${aovStats.orderCount} paid order${aovStats.orderCount === 1 ? "" : "s"}`
              : "No paid orders yet"
          }
          icon={TrendingUp}
        />
      </div>

      {/* Row 2 — customer + operations health */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="Customers (all-time)"
          value={customerStats?.total ?? 0}
          sub="Unique phone numbers"
          icon={Users}
        />
        <StatCard
          label="Returning customers"
          value={`${returningPct}%`}
          sub={
            returningStats?.total
              ? `${returningStats.returning ?? 0} of ${returningStats.total} bought again`
              : "Need first orders to compute"
          }
          icon={Repeat}
        />
        <Link
          href="/admin/inventory"
          className="bg-white rounded-2xl border border-brand-line p-5 hover:border-brand-red transition-colors"
        >
          <div className="flex items-center justify-between">
            <p className="text-xs font-mono font-bold uppercase tracking-widest text-brand-ink-soft">
              Low stock (&lt;{LOW_STOCK_THRESHOLD})
            </p>
            <AlertTriangle
              size={16}
              className={
                (lowStockStats?.count ?? 0) > 0
                  ? "text-brand-red"
                  : "text-brand-ink-soft"
              }
            />
          </div>
          <p
            className={`font-display text-3xl font-bold mt-2 ${
              (lowStockStats?.count ?? 0) > 0
                ? "text-brand-red"
                : "text-brand-ink"
            }`}
          >
            {lowStockStats?.count ?? 0}
          </p>
          <p className="text-xs text-brand-ink-soft mt-1">
            {(lowStockStats?.count ?? 0) > 0
              ? "Variant SKUs need restock — tap to fix"
              : "All variants stocked"}
          </p>
        </Link>
      </div>

      {/* Top SKUs */}
      <div className="bg-white rounded-2xl border border-brand-line">
        <div className="px-5 py-4 border-b border-brand-line flex items-center justify-between">
          <h2 className="font-semibold text-brand-ink">
            Top SKUs <span className="text-brand-ink-soft font-normal">— last 30 days, paid only</span>
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
              <li
                key={s.skuId}
                className="flex items-center gap-4 px-5 py-3"
              >
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
          <ul className="divide-y divide-brand-line">
            {recent.map((o) => (
              <li key={o.id}>
                <Link
                  href={`/admin/orders/${o.id}`}
                  className="flex items-center gap-4 px-5 py-3 hover:bg-brand-cream transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-mono font-semibold text-brand-ink">
                      {o.id}
                    </div>
                    <div className="text-xs text-brand-ink-soft mt-0.5">
                      {new Date(o.placedAt).toLocaleString("en-IN", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}{" "}
                      · {o.paymentMethod}
                    </div>
                  </div>
                  <StatusBadge status={o.status} />
                  <div className="font-semibold text-brand-ink tabular-nums">
                    {formatINR(o.totalInr)}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
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
    <div className="bg-white rounded-2xl border border-brand-line p-5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-mono font-bold uppercase tracking-widest text-brand-ink-soft">
          {label}
        </p>
        <Icon size={16} />
      </div>
      <p className="font-display text-3xl font-bold text-brand-ink mt-2">
        {value}
      </p>
      <p className="text-xs text-brand-ink-soft mt-1">{sub}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    PENDING: "bg-gold/10 text-gold",
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
