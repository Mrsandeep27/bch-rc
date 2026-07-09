import { and, gte, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { orders } from "@/db/schema";
import { requireAdmin } from "@/lib/admin-auth";
import { formatINR } from "@/lib/utils";
import { PAID_STATUSES } from "@/lib/order-status";
import { addUtcDays, istDayStart } from "@/lib/tz";

export const dynamic = "force-dynamic";

export default async function AdminFinance() {
  const ctx = await requireAdmin();

  // Day boundaries are IST, NOT the server's UTC (Vercel). Mirror the rest of
  // the admin (dashboard / analytics) through the shared tz helpers so the
  // 30-day window lines up with the IST dates shown on the orders list.
  const since = addUtcDays(istDayStart(), -29); // inclusive of today → 30 days

  const windowWhere = and(
    gte(orders.placedAt, since),
    inArray(orders.siteId, ctx.siteIds),
  );

  // One aggregation pass over the real orders ledger. Every figure is a FILTER
  // over the actual status/paymentMethod columns — no mock or derived numbers.
  const [totals, methodRows] = await Promise.all([
    db
      .select({
        collectedRevenue: sql<number>`coalesce(sum(${orders.totalInr}) filter (where ${orders.status} in ('PAID','PACKED','SHIPPED','DELIVERED','REFUNDED')), 0)::int`,
        paidRevenue: sql<number>`coalesce(sum(${orders.totalInr}) filter (where ${orders.status} in ('PAID','PACKED','SHIPPED','DELIVERED')), 0)::int`,
        refundValue: sql<number>`coalesce(sum(${orders.totalInr}) filter (where ${orders.status} = 'REFUNDED'), 0)::int`,
        refundCount: sql<number>`count(*) filter (where ${orders.status} = 'REFUNDED')::int`,
        codInFlightValue: sql<number>`coalesce(sum(${orders.totalInr}) filter (where ${orders.paymentMethod} = 'COD' and ${orders.status} in ('PENDING_COD_VERIFICATION','PAID','PACKED','SHIPPED')), 0)::int`,
        codInFlightCount: sql<number>`count(*) filter (where ${orders.paymentMethod} = 'COD' and ${orders.status} in ('PENDING_COD_VERIFICATION','PAID','PACKED','SHIPPED'))::int`,
        rtoLossValue: sql<number>`coalesce(sum(${orders.totalInr}) filter (where ${orders.status} = 'RETURNED'), 0)::int`,
        rtoCount: sql<number>`count(*) filter (where ${orders.status} = 'RETURNED')::int`,
        paidCount: sql<number>`count(*) filter (where ${orders.status} in ('PAID','PACKED','SHIPPED','DELIVERED'))::int`,
      })
      .from(orders)
      .where(windowWhere)
      .then((r) => r[0]),
    // Revenue split by payment method — banked money only (PAID→DELIVERED).
    db
      .select({
        method: orders.paymentMethod,
        paidCount: sql<number>`count(*)::int`,
        paidRevenue: sql<number>`coalesce(sum(${orders.totalInr}), 0)::int`,
      })
      .from(orders)
      .where(
        and(
          gte(orders.placedAt, since),
          inArray(orders.siteId, ctx.siteIds),
          inArray(orders.status, [...PAID_STATUSES]),
        ),
      )
      .groupBy(orders.paymentMethod)
      .orderBy(sql`coalesce(sum(${orders.totalInr}), 0) desc`),
  ]);

  const collectedRevenue = totals?.collectedRevenue ?? 0;
  const paidRevenue = totals?.paidRevenue ?? 0;
  const refundValue = totals?.refundValue ?? 0;
  const refundCount = totals?.refundCount ?? 0;
  const codInFlightValue = totals?.codInFlightValue ?? 0;
  const codInFlightCount = totals?.codInFlightCount ?? 0;
  const rtoValue = totals?.rtoLossValue ?? 0;
  const rtoCount = totals?.rtoCount ?? 0;
  const paidCount = totals?.paidCount ?? 0;

  // Net = cash captured minus what was refunded back out. (Refunded orders are
  // excluded from `paidRevenue` by status, so net == paidRevenue — but deriving
  // it as collected − refunds keeps the card set self-explaining and honest.)
  const netRevenue = collectedRevenue - refundValue;

  const isEmpty = paidCount === 0 && collectedRevenue === 0;

  return (
    <div className="space-y-3 sm:space-y-6">
      <div>
        <h1 className="font-display text-lg sm:text-3xl font-bold text-brand-ink">
          Finance
        </h1>
        <p className="text-sm text-brand-ink-soft mt-1">
          Last 30 days · IST · gross, paid, refunds, COD and RTO from the orders
          ledger.
        </p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-2 sm:gap-4">
        <div className="bg-white rounded-2xl border border-brand-line p-3 sm:p-5">
          <p className="text-[11px] font-mono font-bold uppercase tracking-widest text-brand-ink-soft">
            Collected
          </p>
          <p className="font-display text-xl sm:text-2xl font-bold text-brand-ink mt-2 tabular-nums">
            {formatINR(collectedRevenue)}
          </p>
          <p className="text-xs text-brand-ink-soft mt-1">
            {paidCount} paid · incl. since-refunded
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-brand-line p-3 sm:p-5">
          <p className="text-[11px] font-mono font-bold uppercase tracking-widest text-brand-ink-soft">
            Net revenue
          </p>
          <p className="font-display text-xl sm:text-2xl font-bold text-success mt-2 tabular-nums">
            {formatINR(netRevenue)}
          </p>
          <p className="text-xs text-brand-ink-soft mt-1">
            collected − {refundCount} refund{refundCount === 1 ? "" : "s"}
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-brand-line p-3 sm:p-5">
          <p className="text-[11px] font-mono font-bold uppercase tracking-widest text-brand-ink-soft">
            Refunds
          </p>
          <p className="font-display text-xl sm:text-2xl font-bold text-brand-ink mt-2 tabular-nums">
            {formatINR(refundValue)}
          </p>
          <p className="text-xs text-brand-ink-soft mt-1">
            {refundCount} orders
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-brand-line p-3 sm:p-5">
          <p className="text-[11px] font-mono font-bold uppercase tracking-widest text-brand-ink-soft">
            COD in flight
          </p>
          <p className="font-display text-xl sm:text-2xl font-bold text-brand-ink mt-2 tabular-nums">
            {formatINR(codInFlightValue)}
          </p>
          <p className="text-xs text-brand-ink-soft mt-1">
            {codInFlightCount} shipments, not yet collected
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-brand-line p-3 sm:p-5">
          <p className="text-[11px] font-mono font-bold uppercase tracking-widest text-brand-ink-soft">
            RTO value
          </p>
          <p
            className={`font-display text-xl sm:text-2xl font-bold mt-2 tabular-nums ${
              rtoCount > 0 ? "text-brand-red" : "text-brand-ink"
            }`}
          >
            {formatINR(rtoValue)}
          </p>
          <p className="text-xs text-brand-ink-soft mt-1">
            {rtoCount} returned to origin
          </p>
        </div>
      </div>

      {/* Revenue by payment method */}
      <div className="bg-white rounded-2xl border border-brand-line">
        <div className="px-3 py-3 sm:px-5 sm:py-4 border-b border-brand-line">
          <h2 className="font-semibold text-brand-ink">
            Revenue by payment method{" "}
            <span className="text-brand-ink-soft font-normal">
              — last 30 days, paid
            </span>
          </h2>
        </div>
        {isEmpty || methodRows.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-brand-ink-soft">
            No orders in the last 30 days yet.
          </p>
        ) : (
          <div className="overflow-x-auto no-scrollbar">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] font-mono uppercase tracking-wider text-brand-ink-soft border-b border-brand-line">
                  <th className="text-left px-3 sm:px-5 py-3 font-semibold">Method</th>
                  <th className="text-right px-3 sm:px-5 py-3 font-semibold">Orders</th>
                  <th className="text-right px-3 sm:px-5 py-3 font-semibold whitespace-nowrap">
                    Paid revenue
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-line">
                {methodRows.map((m) => (
                  <tr key={m.method}>
                    <td className="px-3 sm:px-5 py-2.5 sm:py-3 font-semibold text-brand-ink">
                      {m.method}
                    </td>
                    <td className="px-3 sm:px-5 py-2.5 sm:py-3 text-right tabular-nums text-brand-ink-soft">
                      {m.paidCount}
                    </td>
                    <td className="px-3 sm:px-5 py-2.5 sm:py-3 text-right tabular-nums font-semibold whitespace-nowrap text-brand-ink">
                      {formatINR(m.paidRevenue)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-xs text-brand-ink-soft">
        Collected = cash captured (PAID→DELIVERED plus orders since refunded). Net
        = collected − refunds. RTO value is the <b>order value</b> of returns, not
        the freight loss — true reverse-logistics cost isn&rsquo;t tracked in the
        orders table. Figures come straight from the orders ledger;
        settlement/GST reconciliation against Razorpay is not wired yet.
      </p>
    </div>
  );
}
