/**
 * READ-ONLY reconciliation audit: Razorpay captured payments → our orders.
 *
 * Answers two questions the user asked:
 *  1. "Is every captured payment caught — none left silently?"  → for each
 *     CAPTURED Razorpay payment, find the matching order and flag any that is
 *     missing (orphan) or sitting in a non-paid state (ABANDONED/FAILED/etc).
 *  2. "Are the DB times actually wrong?" → compare each order's placedAt to the
 *     payment's created_at. They should differ by only minutes (UTC instants);
 *     a ~5.5h gap would mean a corrupted/shifted timestamp.
 *
 * Pure reads (Razorpay GETs + DB SELECTs). Makes NO changes.
 *   Run: npx tsx --env-file=.env.local scripts/reconcile-check.ts [days]
 */
import { db } from "../src/db";
import { orders } from "../src/db/schema";
import { razorpay } from "../src/lib/razorpay";
import { inArray } from "drizzle-orm";

type Pay = {
  id: string;
  order_id: string | null;
  status: string;
  amount: number;
  created_at: number; // epoch seconds (UTC)
  method?: string | null;
  email?: string | null;
  contact?: string | null;
};

const DAYS = Number(process.argv[2] || 30);
const to = Math.floor(Date.now() / 1000);
const from = to - DAYS * 86400;

async function fetchAllPayments(): Promise<Pay[]> {
  const all: Pay[] = [];
  let skip = 0;
  for (;;) {
    const page = (await razorpay.payments.all({ from, to, count: 100, skip })) as {
      items: Pay[];
    };
    const items = page.items ?? [];
    all.push(...items);
    if (items.length < 100) break;
    skip += 100;
  }
  return all;
}

function istOffsetHours(placedAtMs: number, createdAtSec: number): number {
  return (placedAtMs - createdAtSec * 1000) / 3_600_000;
}

async function main() {
  console.log(`\nRazorpay → DB reconciliation (last ${DAYS} days)\n${"=".repeat(52)}`);
  const payments = await fetchAllPayments();
  const captured = payments.filter((p) => p.status === "captured");
  console.log(
    `Fetched ${payments.length} payments; ${captured.length} CAPTURED (real money in).`,
  );

  const rzpOrderIds = [...new Set(captured.map((p) => p.order_id).filter(Boolean))] as string[];

  // pull every order that matches a captured payment's razorpay order id
  const rows = rzpOrderIds.length
    ? await db
        .select({
          id: orders.id,
          status: orders.status,
          paymentStatus: orders.paymentStatus,
          paymentMethod: orders.paymentMethod,
          totalInr: orders.totalInr,
          confirmationFeeInr: orders.confirmationFeeInr,
          razorpayOrderId: orders.razorpayOrderId,
          razorpayPaymentId: orders.razorpayPaymentId,
          placedAt: orders.placedAt,
          paidAt: orders.paidAt,
        })
        .from(orders)
        .where(inArray(orders.razorpayOrderId, rzpOrderIds))
    : [];

  const byRzp = new Map(rows.map((r) => [r.razorpayOrderId!, r]));

  const PAID_OK = new Set([
    "PAID",
    "PACKED",
    "SHIPPED",
    "DELIVERED",
    "PENDING_COD_VERIFICATION",
  ]);

  const orphans: Pay[] = [];
  const dropped: { pay: Pay; order: (typeof rows)[number] }[] = [];
  const amountMismatch: { pay: Pay; order: (typeof rows)[number] }[] = [];
  const timeShift: { pay: Pay; order: (typeof rows)[number]; hrs: number }[] = [];
  let ok = 0;

  for (const p of captured) {
    const o = p.order_id ? byRzp.get(p.order_id) : undefined;
    if (!o) {
      orphans.push(p);
      continue;
    }
    // expected captured amount: full total (prepaid) or confirmation fee (partial COD)
    const isPartialCod = o.paymentMethod === "COD" && (o.confirmationFeeInr ?? 0) > 0;
    const expectedPaise = (isPartialCod ? o.confirmationFeeInr : o.totalInr) * 100;
    if (Number(p.amount) !== expectedPaise) amountMismatch.push({ pay: p, order: o });

    // time sanity — should be minutes apart, not hours
    const hrs = istOffsetHours(new Date(o.placedAt).getTime(), p.created_at);
    if (Math.abs(hrs) > 1) timeShift.push({ pay: p, order: o, hrs });

    if (PAID_OK.has(o.status)) ok++;
    else dropped.push({ pay: p, order: o });
  }

  console.log(`\n✅ Captured → order in a good state: ${ok}/${captured.length}`);

  console.log(`\n🚨 ORPHANS — captured payment, NO order row (${orphans.length}):`);
  for (const p of orphans)
    console.log(
      `   ${p.id}  rzpOrder=${p.order_id}  ₹${(p.amount / 100).toFixed(0)}  ${new Date(
        p.created_at * 1000,
      ).toISOString()}  ${p.contact ?? ""} ${p.email ?? ""}`,
    );

  console.log(`\n🚨 DROPPED — captured payment, order NOT paid (${dropped.length}):`);
  for (const { pay, order } of dropped)
    console.log(
      `   ${order.id}  status=${order.status}/${order.paymentStatus}  pay=${pay.id}  ₹${(
        pay.amount / 100
      ).toFixed(0)}`,
    );

  console.log(`\n⚠️  AMOUNT MISMATCH (${amountMismatch.length}):`);
  for (const { pay, order } of amountMismatch)
    console.log(
      `   ${order.id}  paid ₹${(pay.amount / 100).toFixed(0)}  expected ₹${
        (order.paymentMethod === "COD" && (order.confirmationFeeInr ?? 0) > 0
          ? order.confirmationFeeInr
          : order.totalInr)
      }`,
    );

  console.log(`\n🕐 TIME SHIFT >1h between placedAt and payment (${timeShift.length}):`);
  for (const { order, hrs } of timeShift)
    console.log(`   ${order.id}  placedAt is ${hrs.toFixed(2)}h vs payment.created_at`);
  if (timeShift.length === 0)
    console.log(
      "   none — every placedAt is within ~1h of its payment (DB instants are correct; the admin display was just rendering UTC).",
    );

  console.log(`\n${"=".repeat(52)}`);
  console.log(
    `SUMMARY: ${captured.length} captured | ${ok} good | ${dropped.length} dropped | ${orphans.length} orphan | ${amountMismatch.length} amount-mismatch`,
  );
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
