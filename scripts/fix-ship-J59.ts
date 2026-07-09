/**
 * ONE-OFF fix for PRC-J59RPY6C: shorten the over-190-char shipping address
 * (customer pasted duplicated text) so Shiprocket accepts it, then create the
 * shipment. Preserves every deliverable detail; only removes duplication.
 *   Run: npx tsx --env-file=.env.local scripts/fix-ship-J59.ts
 */
import { eq } from "drizzle-orm";
import { db } from "../src/db";
import { orders, shipmentJobs } from "../src/db/schema";
import { runShipmentJobOnce } from "../src/lib/fulfillment/shipment-queue";

const ID = "PRC-J59RPY6C";
const NEW_LINE1 =
  "Sai Nilayam Apartments, 5th Floor, Flat No 501, Old Madras Rd, Sakshi Nagar, Pai Layout, Mahadevapura";
const NEW_LINE2 = "Near Kids Castle Preschool";

async function main() {
  const [o] = await db.select().from(orders).where(eq(orders.id, ID));
  if (!o) throw new Error("order not found");
  const addr = o.shippingAddress as Record<string, unknown>;

  console.log("BEFORE:");
  console.log(`  line1 (${String(addr.line1 ?? "").length}): ${addr.line1}`);
  console.log(`  line2 (${String(addr.line2 ?? "").length}): ${addr.line2}`);

  const combined = NEW_LINE1.length + NEW_LINE2.length;
  console.log(`\nAFTER:`);
  console.log(`  line1 (${NEW_LINE1.length}): ${NEW_LINE1}`);
  console.log(`  line2 (${NEW_LINE2.length}): ${NEW_LINE2}`);
  console.log(`  combined = ${combined} (max 190)`);
  if (combined > 190) throw new Error("still over 190 — aborting");

  // 1. Write the cleaned address (spread existing so city/state/pincode/phone
  //    /name/email are untouched).
  const newAddr = { ...addr, line1: NEW_LINE1, line2: NEW_LINE2 };
  await db.update(orders).set({ shippingAddress: newAddr, updatedAt: new Date() }).where(eq(orders.id, ID));
  console.log("\n✅ address updated in DB.");

  // 2. Make the job immediately due again (it was backing off after the 400).
  await db
    .update(shipmentJobs)
    .set({ status: "PENDING", lockedAt: null, nextAttemptAt: new Date(), lastError: null, updatedAt: new Date() })
    .where(eq(shipmentJobs.orderId, ID));
  console.log("✅ shipment job reset to PENDING (due now).");

  // 3. Create the shipment right now.
  console.log("\nRunning shipment job…");
  const res = await runShipmentJobOnce(ID);
  console.log("result:", JSON.stringify(res, null, 2));

  const [after] = await db
    .select({
      status: orders.status,
      shiprocketOrderId: orders.shiprocketOrderId,
      shiprocketShipmentId: orders.shiprocketShipmentId,
      awbCode: orders.awbCode,
      courierName: orders.courierName,
    })
    .from(orders)
    .where(eq(orders.id, ID));
  console.log("\nORDER NOW:", JSON.stringify(after, null, 2));
  process.exit(0);
}
main().catch((e) => {
  console.error("FAILED:", e);
  process.exit(1);
});
