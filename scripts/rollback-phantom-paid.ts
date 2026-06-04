/**
 * Cleanup script for the 4 phantom-paid orders identified by
 * scripts/audit-paid-orders.ts. Each order:
 *   1. Re-confirms with Razorpay that NO captured payment exists
 *   2. Sets status=FAILED, paymentStatus=FAILED, cancelledAt=now
 *   3. Releases reserved inventory + coupon usage
 *   4. Cancels the Shiprocket order (if shiprocket_order_id present)
 *   5. Logs a PHANTOM_PAYMENT_ROLLBACK audit event
 *
 * Idempotent: orders already rolled back are skipped. Run with `--dry-run`
 * to preview without mutating anything.
 */

import { eq } from "drizzle-orm";
import { db } from "../src/db";
import { orders, events } from "../src/db/schema";
import { razorpay } from "../src/lib/razorpay";
import { cancelShiprocketOrder } from "../src/lib/shiprocket";
import { releaseOrderHolds } from "../src/lib/inventory/release";

const PHANTOM_ORDER_IDS = [
  "PRC-32X7WCF8",
  "PRC-B82NE8S3",
  "PRC-VRDTU6H7",
  "PRC-2GGXA3XQ",
];

const DRY_RUN = process.argv.includes("--dry-run");

async function rollbackOne(orderId: string) {
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId));
  if (!order) {
    console.log(`${orderId}: NOT FOUND — skipping`);
    return;
  }
  if (order.status === "FAILED") {
    console.log(`${orderId}: already FAILED — skipping`);
    return;
  }
  if (!order.razorpayOrderId) {
    console.log(`${orderId}: no razorpay_order_id — skipping`);
    return;
  }

  const list = await razorpay.orders.fetchPayments(order.razorpayOrderId);
  const captured = (list.items as { status: string; id: string; amount: number }[]).find(
    (p) => p.status === "captured",
  );
  if (captured) {
    console.log(
      `${orderId}: SAFETY ABORT — Razorpay DOES have a captured payment ${captured.id} ₹${captured.amount / 100}. Not rolling back.`,
    );
    return;
  }

  console.log(
    `${orderId}: ready to roll back. DB=${order.status}/${order.paymentStatus} ₹${order.totalInr} shiprocket=${order.shiprocketOrderId ?? "-"}`,
  );

  if (DRY_RUN) {
    console.log(`${orderId}: --dry-run, skipping mutations`);
    return;
  }

  let shiprocketResult: { ok: boolean; message: string } | null = null;
  if (order.shiprocketOrderId) {
    shiprocketResult = await cancelShiprocketOrder(order.shiprocketOrderId);
    console.log(
      `${orderId}: shiprocket cancel ${order.shiprocketOrderId} → ${shiprocketResult.ok ? "OK" : "FAIL"} (${shiprocketResult.message})`,
    );
  }

  await db
    .update(orders)
    .set({
      status: "FAILED",
      paymentStatus: "FAILED",
      cancelledAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(orders.id, orderId));

  let releaseResult: unknown = null;
  try {
    releaseResult = await releaseOrderHolds(orderId, "PAYMENT_FAILED");
    console.log(`${orderId}: stock/coupon release → ${JSON.stringify(releaseResult)}`);
  } catch (err) {
    console.log(`${orderId}: stock/coupon release FAILED → ${err instanceof Error ? err.message : err}`);
  }

  await db.insert(events).values({
    siteId: order.siteId,
    orderId,
    customerId: order.customerId,
    type: "PHANTOM_PAYMENT_ROLLBACK",
    payload: {
      reason: "Razorpay API confirmed no captured payment for this order",
      previousStatus: order.status,
      previousPaymentStatus: order.paymentStatus,
      razorpayOrderId: order.razorpayOrderId,
      storedRazorpayPaymentId: order.razorpayPaymentId,
      shiprocketOrderId: order.shiprocketOrderId,
      shiprocketCancel: shiprocketResult,
      releaseResult,
    },
    source: "system",
  });

  console.log(`${orderId}: rollback complete`);
}

async function main() {
  console.log(`Running ${DRY_RUN ? "DRY-RUN" : "LIVE"} rollback for ${PHANTOM_ORDER_IDS.length} orders\n`);
  for (const id of PHANTOM_ORDER_IDS) {
    try {
      await rollbackOne(id);
    } catch (err) {
      console.log(`${id}: ERROR ${err instanceof Error ? err.message : err}`);
    }
    console.log("");
  }
  process.exit(0);
}
main();
