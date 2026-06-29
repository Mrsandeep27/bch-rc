/**
 * One-off: hard-delete two confirmed TEST orders that were muddying the
 * captured-payment reconciliation (both CANCELLED):
 *   PRC-JBD34KCQ  — ₹1 test payment
 *   PRC-HK79V9QW  — ₹1199, manually cancelled from pack with reason "test order"
 *
 * Orders have FK children WITHOUT cascade, so we delete children first inside a
 * transaction, then the order. A full JSON backup of each order is printed
 * BEFORE deletion (recovery record in the run log).
 *
 * NOTE: PRC-HK79V9QW's ₹1199 is still CAPTURED in Razorpay — deleting our row
 * does NOT refund it (it's the owner's own test money).
 *
 *   Run: npx tsx --env-file=.env.local scripts/delete-test-orders.ts
 */
import { db } from "../src/db";
import {
  orders,
  events,
  shipmentJobs,
  notificationsOutbox,
  customerCouponRedemptions,
  reviews,
} from "../src/db/schema";
import { inArray } from "drizzle-orm";

// Per owner decision: delete ONLY the ₹1 test order. PRC-HK79V9QW is kept
// (its ₹1199 is still captured in Razorpay).
const IDS = ["PRC-JBD34KCQ"];

async function main() {
  const existing = await db.select().from(orders).where(inArray(orders.id, IDS));
  if (existing.length === 0) {
    console.log("Neither order exists — nothing to delete.");
    process.exit(0);
  }

  console.log("=== BACKUP (full rows before delete) ===");
  for (const o of existing) console.log(JSON.stringify(o));
  const found = existing.map((o) => o.id);
  console.log(`\nDeleting ${found.length} order(s): ${found.join(", ")}\n`);

  const counts: Record<string, number> = {};
  await db.transaction(async (tx) => {
    const del = async (label: string, p: Promise<{ rowCount?: number | null } | unknown>) => {
      const r = (await p) as { rowCount?: number | null };
      counts[label] = r?.rowCount ?? 0;
    };

    // children first (no ON DELETE CASCADE on these FKs)
    await del("reviews", tx.delete(reviews).where(inArray(reviews.orderId, found)));
    await del(
      "customerCouponRedemptions",
      tx.delete(customerCouponRedemptions).where(inArray(customerCouponRedemptions.orderId, found)),
    );
    await del(
      "notificationsOutbox",
      tx.delete(notificationsOutbox).where(inArray(notificationsOutbox.orderId, found)),
    );
    await del("shipmentJobs", tx.delete(shipmentJobs).where(inArray(shipmentJobs.orderId, found)));
    await del("events", tx.delete(events).where(inArray(events.orderId, found)));
    // (analytics_sessions.order_id is a loose text column with no FK — a dangling
    //  value is harmless and doesn't block the delete, so we leave it.)
    // finally the orders
    await del("orders", tx.delete(orders).where(inArray(orders.id, found)));
  });

  console.log("=== DELETED ROW COUNTS ===");
  console.log(counts);

  const left = await db.select({ id: orders.id }).from(orders).where(inArray(orders.id, IDS));
  console.log(`\nRemaining of target ids: ${left.length === 0 ? "none ✅" : left.map((r) => r.id).join(", ")}`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
