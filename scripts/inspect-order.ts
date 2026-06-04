import { db } from "../src/db";
import { orders, events, shipmentJobs } from "../src/db/schema";
import { eq, desc } from "drizzle-orm";

const ORDER_ID = process.argv[2] || "PRC-VRDTU6H7";

async function main() {
  const [order] = await db.select().from(orders).where(eq(orders.id, ORDER_ID));
  if (!order) {
    console.log("Order not found:", ORDER_ID);
    process.exit(0);
  }
  console.log("=== ORDER ===");
  console.log({
    id: order.id,
    status: order.status,
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
    razorpayOrderId: order.razorpayOrderId,
    razorpayPaymentId: order.razorpayPaymentId,
    shiprocketOrderId: order.shiprocketOrderId,
    awbCode: order.awbCode,
    placedAt: order.placedAt,
    paidAt: order.paidAt,
    packedAt: order.packedAt,
    totalInr: order.totalInr,
    subtotalInr: order.subtotalInr,
  });

  const [job] = await db
    .select()
    .from(shipmentJobs)
    .where(eq(shipmentJobs.orderId, ORDER_ID));
  console.log("\n=== SHIPMENT JOB ===");
  console.log(job ?? "no job row");

  const evs = await db
    .select()
    .from(events)
    .where(eq(events.orderId, ORDER_ID))
    .orderBy(desc(events.createdAt));
  console.log("\n=== EVENTS (newest first) ===");
  for (const e of evs) {
    console.log(`${e.createdAt?.toISOString?.() ?? e.createdAt} | ${e.type} | ${e.source} | ${JSON.stringify(e.payload).slice(0, 200)}`);
  }
  process.exit(0);
}
main();
