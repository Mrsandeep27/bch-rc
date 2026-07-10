/**
 * ONE-TIME data correction: fix orders the buggy mapper mislabelled DELIVERED
 * when Shiprocket had actually RTO'd them.
 *
 * Safety:
 *  - Operates on an explicit allow-list of order ids. Nothing else is touched.
 *  - RE-VERIFIES each order against Shiprocket live at apply time; if the live
 *    status no longer maps to RETURNED, that order is SKIPPED (belt and braces
 *    against a status that changed since the audit).
 *  - Requires --apply to write. Without it, dry-runs and prints the plan.
 *  - Wraps each order in its own transaction: status flip + shipped_at backfill
 *    + audit event, then releases holds (idempotent) outside the txn.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/fix-rto-orders.ts           # dry run
 *   npx tsx --env-file=.env.local scripts/fix-rto-orders.ts --apply   # write
 */
import { and, eq, inArray } from "drizzle-orm";
import { db } from "../src/db";
import { orders, events } from "../src/db/schema";
import { getShipmentStatus, mapShiprocketStatus } from "../src/lib/shiprocket";
import { releaseOrderHoldsBestEffort } from "../src/lib/inventory/release";

/** The 4 confirmed by the read-only audit. Re-checked live before any write. */
const TARGET_IDS = [
  "PRC-LUY6F946",
  "PRC-RJLYDFPM",
  "PRC-H8ZVK63Y",
  "PRC-LDFFSXZP",
] as const;

const APPLY = process.argv.includes("--apply");

async function main() {
  console.log(`\n${APPLY ? "APPLY" : "DRY RUN"} — correcting up to ${TARGET_IDS.length} RTO orders\n`);

  const rows = await db
    .select({
      id: orders.id,
      status: orders.status,
      paymentMethod: orders.paymentMethod,
      totalInr: orders.totalInr,
      shipmentId: orders.shiprocketShipmentId,
      shippedAt: orders.shippedAt,
      deliveredAt: orders.deliveredAt,
      siteId: orders.siteId,
      customerId: orders.customerId,
    })
    .from(orders)
    .where(inArray(orders.id, [...TARGET_IDS]));

  let corrected = 0;
  let skipped = 0;

  for (const o of rows) {
    if (!o.shipmentId) {
      console.log(`SKIP ${o.id}: no shipment id`);
      skipped++;
      continue;
    }

    // Re-verify live — never write off a stale audit.
    const live = await getShipmentStatus(o.shipmentId);
    const mapped = mapShiprocketStatus(live.current_status);
    if (mapped !== "RETURNED") {
      console.log(`SKIP ${o.id}: live status "${live.current_status}" -> ${mapped}, not RETURNED`);
      skipped++;
      continue;
    }
    if (o.status === "RETURNED") {
      console.log(`SKIP ${o.id}: already RETURNED`);
      skipped++;
      continue;
    }

    console.log(
      `${APPLY ? "FIX " : "WOULD FIX "} ${o.id}  ${o.paymentMethod} ₹${o.totalInr}  ` +
        `${o.status} -> RETURNED   (live: "${live.current_status}")`,
    );

    if (!APPLY) {
      corrected++;
      continue;
    }

    const now = new Date();
    await db.transaction(async (tx) => {
      // Guard the flip on the CURRENT status so a concurrent run can't double it.
      const updated = await tx
        .update(orders)
        .set({
          status: "RETURNED",
          // The buggy path stamped delivered_at; a returned parcel was never
          // delivered, so clear it. shipped_at is real (it did ship), keep or
          // backfill it.
          deliveredAt: null,
          shippedAt: o.shippedAt ?? now,
          updatedAt: now,
        })
        .where(and(eq(orders.id, o.id), inArray(orders.status, ["DELIVERED", "SHIPPED"])))
        .returning({ id: orders.id });

      if (updated.length === 0) return; // someone else moved it; no-op

      await tx.insert(events).values({
        siteId: o.siteId,
        orderId: o.id,
        customerId: o.customerId,
        type: "RTO_CORRECTION",
        payload: {
          from: o.status,
          to: "RETURNED",
          liveStatus: live.current_status,
          reason: "buggy mapShiprocketStatus marked an RTO'd parcel DELIVERED; corrected from Shiprocket live status",
          clearedDeliveredAt: o.deliveredAt !== null,
        },
        source: "system",
      });
    });

    // Return reserved stock + coupon to the pool. Idempotent (holds_released).
    await releaseOrderHoldsBestEffort(o.id, "RTO");
    corrected++;
  }

  console.log(`\n${APPLY ? "Corrected" : "Would correct"}: ${corrected}   Skipped: ${skipped}`);
  if (!APPLY) console.log("Re-run with --apply to write.");
  process.exit(0);
}
main().catch((e) => {
  console.error("THROW:", e instanceof Error ? e.message : e);
  process.exit(1);
});
