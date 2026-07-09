/**
 * READ-ONLY single-order lookup: DB row + Razorpay payment state.
 *   Run: npx tsx --env-file=.env.local scripts/lookup-order.ts PRC-3CWRQQJ4
 */
import { db } from "../src/db";
import { orders, customers } from "../src/db/schema";
import { razorpay } from "../src/lib/razorpay";
import { eq } from "drizzle-orm";

const ID = process.argv[2];
if (!ID) {
  console.error("usage: lookup-order.ts <ORDER_ID>");
  process.exit(1);
}

async function main() {
  const [o] = await db.select().from(orders).where(eq(orders.id, ID)).limit(1);
  if (!o) {
    console.log(`No order row for ${ID}`);
    process.exit(0);
  }
  const [cust] = o.customerId
    ? await db.select().from(customers).where(eq(customers.id, o.customerId)).limit(1)
    : [undefined];

  console.log(`\n===== ORDER ${o.id} =====`);
  console.log(`site:            ${o.siteId}`);
  console.log(`status:          ${o.status}`);
  console.log(`paymentStatus:   ${o.paymentStatus}`);
  console.log(`paymentMethod:   ${o.paymentMethod}`);
  console.log(`total:           ₹${o.totalInr}  (subtotal ₹${o.subtotalInr}, ship ₹${o.shippingInr}, codFee ₹${o.codFeeInr}, confFee ₹${o.confirmationFeeInr}, disc ₹${o.discountInr})`);
  console.log(`placedAt (UTC):  ${o.placedAt ? new Date(o.placedAt).toISOString() : "—"}`);
  console.log(`placedAt (IST):  ${o.placedAt ? new Date(o.placedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) : "—"}`);
  console.log(`paidAt:          ${o.paidAt ? new Date(o.paidAt).toISOString() : "—"}`);
  console.log(`createdVia:      ${(o as Record<string, unknown>).createdVia ?? "—"}`);
  console.log(`rzpOrderId:      ${o.razorpayOrderId ?? "—"}`);
  console.log(`rzpPaymentId:    ${o.razorpayPaymentId ?? "—"}`);
  console.log(`rzpPayLinkId:    ${o.razorpayPaymentLinkId ?? "—"}`);
  console.log(`awb / courier:   ${o.awbCode ?? "—"} / ${o.courierName ?? "—"}`);
  console.log(`customer:        ${cust?.name ?? "—"}  ${cust?.phone ?? "—"}  ${cust?.email ?? ""}`);
  const items = (o.items as Array<Record<string, unknown>>) ?? [];
  console.log(`items:`);
  for (const it of items) console.log(`   - ${it.name ?? it.title ?? "?"}  x${it.qty ?? it.quantity ?? 1}  ₹${it.price ?? "?"}`);
  const addr = o.shippingAddress as Record<string, unknown>;
  console.log(`ship to:         ${addr?.city ?? "?"}, ${addr?.state ?? "?"} ${addr?.pincode ?? ""}`);

  // ---- Razorpay side ----
  console.log(`\n----- RAZORPAY -----`);
  if (o.razorpayOrderId) {
    try {
      const rzpOrder = await razorpay.orders.fetch(o.razorpayOrderId);
      console.log(`rzp order:       ${rzpOrder.id}  status=${rzpOrder.status}  amount=₹${Number(rzpOrder.amount) / 100}  attempts=${rzpOrder.attempts}`);
      const pays = (await razorpay.orders.fetchPayments(o.razorpayOrderId)) as unknown as { items: Array<Record<string, unknown>> };
      console.log(`payments on order: ${pays.items.length}`);
      for (const p of pays.items) {
        console.log(`   - ${p.id}  status=${p.status}  method=${p.method}  ₹${Number(p.amount) / 100}  captured=${p.captured}  err=${p.error_description ?? ""}  at=${new Date(Number(p.created_at) * 1000).toISOString()}`);
      }
    } catch (e) {
      console.log(`rzp order fetch failed: ${(e as Error).message}`);
    }
  } else if (o.razorpayPaymentLinkId) {
    try {
      const pl = await razorpay.paymentLink.fetch(o.razorpayPaymentLinkId);
      console.log(`payment link:    ${pl.id}  status=${pl.status}  amount=₹${Number(pl.amount) / 100}  short_url=${pl.short_url}`);
    } catch (e) {
      console.log(`payment link fetch failed: ${(e as Error).message}`);
    }
  } else {
    console.log(`No Razorpay order/link id on this row — payment was never initiated (customer left before paying).`);
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
