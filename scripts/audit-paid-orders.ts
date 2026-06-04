import { db } from "../src/db";
import { orders } from "../src/db/schema";
import { eq, isNotNull, and, ne } from "drizzle-orm";
import { razorpay } from "../src/lib/razorpay";

async function main() {
  const rows = await db
    .select({
      id: orders.id,
      status: orders.status,
      paymentStatus: orders.paymentStatus,
      paymentMethod: orders.paymentMethod,
      razorpayOrderId: orders.razorpayOrderId,
      razorpayPaymentId: orders.razorpayPaymentId,
      paidAt: orders.paidAt,
      totalInr: orders.totalInr,
      shiprocketOrderId: orders.shiprocketOrderId,
    })
    .from(orders)
    .where(
      and(
        ne(orders.paymentMethod, "COD"),
        isNotNull(orders.razorpayOrderId),
      ),
    );

  console.log(`Total prepaid orders with razorpay_order_id: ${rows.length}`);
  console.log("");

  let realPaid = 0;
  let phantomPaid = 0;
  const phantoms: typeof rows = [];

  for (const o of rows) {
    let rzpStatus = "n/a";
    let onAccount = false;
    try {
      const list = await razorpay.orders.fetchPayments(o.razorpayOrderId!);
      onAccount = true;
      const captured = (list.items as { status: string; amount: number; id: string }[]).find(
        (p) => p.status === "captured",
      );
      rzpStatus = captured ? `captured ${captured.id} ₹${captured.amount / 100}` : `no captured (count=${list.count})`;
      if (captured) realPaid++;
      else if (o.paymentStatus === "CAPTURED") {
        phantomPaid++;
        phantoms.push(o);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : JSON.stringify(err);
      rzpStatus = `ERR ${msg.slice(0, 80)}`;
      if (o.paymentStatus === "CAPTURED") {
        phantomPaid++;
        phantoms.push(o);
      }
    }

    console.log(
      `${o.id} | DB=${o.status}/${o.paymentStatus} | ₹${o.totalInr} | rzp=${o.razorpayOrderId} | onAccount=${onAccount} | ${rzpStatus} | ship=${o.shiprocketOrderId ?? "-"}`,
    );
  }

  console.log("");
  console.log(`SUMMARY: realPaid=${realPaid} phantomPaid=${phantomPaid}`);
  if (phantoms.length > 0) {
    console.log("\nPHANTOM PAID (DB says CAPTURED, Razorpay has no captured payment):");
    for (const o of phantoms) {
      console.log(`  ${o.id} | ₹${o.totalInr} | paidAt=${o.paidAt?.toISOString?.()} | rzp_order=${o.razorpayOrderId} | rzp_pay=${o.razorpayPaymentId} | shiprocket=${o.shiprocketOrderId ?? "-"}`);
    }
  }
  process.exit(0);
}
main();
