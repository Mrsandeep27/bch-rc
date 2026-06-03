import Link from "next/link";
import { sql, inArray } from "drizzle-orm";
import { db } from "@/db";
import { customers, orders } from "@/db/schema";
import { requireAdmin } from "@/lib/admin-auth";
import { formatINR } from "@/lib/utils";

export default async function AdminCustomers() {
  const ctx = await requireAdmin();

  // Top customers by lifetime spend across the admin's sites.
  const list = await db
    .select({
      id: customers.id,
      phone: customers.phone,
      email: customers.email,
      name: customers.name,
      totalOrders: customers.totalOrders,
      totalSpentInr: customers.totalSpentInr,
      orderCount: sql<number>`count(${orders.id})::int`,
      revenue: sql<number>`coalesce(sum(${orders.totalInr}), 0)::int`,
    })
    .from(customers)
    .leftJoin(orders, sql`${orders.customerId} = ${customers.id} AND ${inArray(orders.siteId, ctx.siteIds)}`)
    .groupBy(customers.id)
    .orderBy(sql`coalesce(sum(${orders.totalInr}), 0) desc`)
    .limit(50);

  return (
    <div className="space-y-5">
      <h1 className="font-display text-2xl sm:text-3xl font-bold text-brand-ink">
        Customers
      </h1>
      <p className="text-sm text-brand-ink-soft">
        Showing top {list.length} customers by lifetime spend across your sites.
      </p>

      <div className="bg-white rounded-2xl border border-brand-line overflow-x-auto">
        {list.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-brand-ink-soft">
            No customers yet.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-brand-cream text-xs font-mono uppercase tracking-widest text-brand-ink-soft">
              <tr>
                <th className="px-5 py-3 text-left">Customer</th>
                <th className="px-5 py-3 text-left">Phone</th>
                <th className="px-5 py-3 text-right">Orders</th>
                <th className="px-5 py-3 text-right">Spent</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-line">
              {list.map((c) => (
                <tr key={c.id} className="hover:bg-brand-cream transition-colors">
                  <td className="px-5 py-3">
                    <Link
                      href={`/admin/customers/${c.id}`}
                      className="block font-semibold text-brand-ink hover:text-brand-red"
                    >
                      {c.name ?? "—"}
                    </Link>
                    {c.email && (
                      <div className="text-xs text-brand-ink-soft">
                        {c.email}
                      </div>
                    )}
                  </td>
                  <td className="px-5 py-3 font-mono text-brand-ink-soft">
                    {c.phone}
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums">
                    {c.orderCount}
                  </td>
                  <td className="px-5 py-3 text-right font-semibold tabular-nums">
                    {formatINR(c.revenue)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
