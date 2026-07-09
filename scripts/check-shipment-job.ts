/**
 * READ-ONLY: dump the shipment_jobs row(s) for given order ids.
 *   Run: npx tsx --env-file=.env.local scripts/check-shipment-job.ts PRC-A PRC-B
 */
import { inArray } from "drizzle-orm";
import { db } from "../src/db";
import { shipmentJobs, orders } from "../src/db/schema";

async function main() {
  const ids = process.argv.slice(2);
  if (!ids.length) return console.log("usage: check-shipment-job.ts <ORDER_ID...>");

  const jobs = await db.select().from(shipmentJobs).where(inArray(shipmentJobs.orderId, ids));
  const ords = await db
    .select({
      id: orders.id,
      status: orders.status,
      shiprocketOrderId: orders.shiprocketOrderId,
      awbCode: orders.awbCode,
      paidAt: orders.paidAt,
    })
    .from(orders)
    .where(inArray(orders.id, ids));
  const omap = new Map(ords.map((o) => [o.id, o]));

  for (const id of ids) {
    const j = jobs.find((x) => x.orderId === id);
    const o = omap.get(id);
    console.log(`\n===== ${id} =====`);
    console.log(`order.status:        ${o?.status ?? "—"}`);
    console.log(`order.shiprocketId:  ${o?.shiprocketOrderId ?? "—"}`);
    console.log(`order.awb:           ${o?.awbCode ?? "—"}`);
    console.log(`order.paidAt:        ${o?.paidAt ? new Date(o.paidAt).toISOString() : "—"}`);
    if (!j) {
      console.log(`shipment_job:        ❌ NONE — no job row was ever created for this order.`);
      continue;
    }
    console.log(`shipment_job.status: ${j.status}`);
    console.log(`  attempts:          ${j.attempts} / ${j.maxAttempts}`);
    console.log(`  nextAttemptAt:     ${j.nextAttemptAt ? new Date(j.nextAttemptAt).toISOString() : "—"}`);
    console.log(`  lockedAt:          ${j.lockedAt ? new Date(j.lockedAt).toISOString() : "—"}`);
    console.log(`  createdAt:         ${j.createdAt ? new Date(j.createdAt).toISOString() : "—"}`);
    console.log(`  updatedAt:         ${j.updatedAt ? new Date(j.updatedAt).toISOString() : "—"}`);
    console.log(`  lastError:         ${j.lastError ?? "—"}`);
  }
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
