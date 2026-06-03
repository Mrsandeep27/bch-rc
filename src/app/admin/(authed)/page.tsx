import Link from "next/link";
import { ArrowUpRight, IndianRupee, Package, Users } from "lucide-react";
import { and, count, desc, gte, inArray, sum } from "drizzle-orm";
import { db } from "@/db";
import { orders, customers } from "@/db/schema";
import { requireAdmin } from "@/lib/admin-auth";
import { formatINR } from "@/lib/utils";

export default async function AdminOverview() {
  const ctx = await requireAdmin();

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const last7 = new Date(today);
  last7.setDate(last7.getDate() - 7);

  // Run the four aggregate queries in parallel. With max: 3 on the postgres-js
  // pool they actually parallelise — total wall-clock is the slowest single
  // query (~30 ms warm in-region) instead of the sum of all four. This is the
  // difference between a snappy admin page and a ~4× longer dead-air load.
  const [todayStats, weekStats, customerStats, recent] = await Promise.all([
    db
      .select({
        orderCount: count(orders.id),
        revenue: sum(orders.totalInr).mapWith(Number),
      })
      .from(orders)
      .where(
        and(gte(orders.placedAt, today), inArray(orders.siteId, ctx.siteIds)),
      )
      .then((rows) => rows[0]),
    db
      .select({
        orderCount: count(orders.id),
        revenue: sum(orders.totalInr).mapWith(Number),
      })
      .from(orders)
      .where(
        and(gte(orders.placedAt, last7), inArray(orders.siteId, ctx.siteIds)),
      )
      .then((rows) => rows[0]),
    db
      .select({ total: count(customers.id) })
      .from(customers)
      .then((rows) => rows[0]),
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
      .limit(8),
  ]);

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
          label="Customers (all-time)"
          value={customerStats?.total ?? 0}
          sub="Across all sites"
          icon={Users}
        />
      </div>

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
  value: number;
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
