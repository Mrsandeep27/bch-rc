/**
 * READ-ONLY: does a given order surface on the /admin/recovery queue?
 * Replicates the recovery page's filters for one customer.
 *   Run: npx tsx --env-file=.env.local scripts/check-recovery.ts PRC-3CWRQQJ4
 */
import { and, desc, eq, gte, inArray, lt } from "drizzle-orm";
import { db } from "../src/db";
import { orders } from "../src/db/schema";

const ID = process.argv[2];
const RECOVERABLE = ["PENDING", "ABANDONED", "FAILED"] as const;
const PAID = ["PAID", "PACKED", "SHIPPED", "DELIVERED"] as const;
const MIN_AGE_MIN = 5;
const COLD_DAYS = 90;

async function main() {
  const [o] = await db.select().from(orders).where(eq(orders.id, ID)).limit(1);
  if (!o) return console.log(`no order ${ID}`);

  const nowMs = Date.now();
  const since = new Date(nowMs - COLD_DAYS * 86_400_000);
  const until = new Date(nowMs - MIN_AGE_MIN * 60_000);
  const ageMin = Math.floor((nowMs - new Date(o.placedAt).getTime()) / 60000);

  console.log(`\nOrder ${ID}: status=${o.status} site=${o.siteId} placed ${ageMin}m ago  customer=${o.customerId}`);

  // gate checks
  const gates = {
    "status recoverable": (RECOVERABLE as readonly string[]).includes(o.status),
    "age > 5min": new Date(o.placedAt) < until,
    "within 90d": new Date(o.placedAt) >= since,
  };
  console.log("\nFilter gates:");
  for (const [k, v] of Object.entries(gates)) console.log(`  ${v ? "✅" : "❌"} ${k}`);

  // did this customer pay ANYTHING in window? -> would be excluded
  const paid = await db
    .select({ id: orders.id, status: orders.status, placedAt: orders.placedAt })
    .from(orders)
    .where(and(eq(orders.customerId, o.customerId), inArray(orders.status, [...PAID]), gte(orders.placedAt, since)));
  console.log(`\nPaid orders by this customer in window: ${paid.length}`);
  for (const p of paid) console.log(`   ${p.id}  ${p.status}  ${new Date(p.placedAt).toISOString()}`);
  if (paid.length) console.log("   ⚠️ EXCLUDED — customer already paid, so not shown in recovery.");

  // newer unpaid attempts by same customer -> would dedupe this one out
  const attempts = await db
    .select({ id: orders.id, status: orders.status, placedAt: orders.placedAt })
    .from(orders)
    .where(
      and(
        eq(orders.customerId, o.customerId),
        inArray(orders.status, [...RECOVERABLE]),
        gte(orders.placedAt, since),
        lt(orders.placedAt, until),
      ),
    )
    .orderBy(desc(orders.placedAt));
  console.log(`\nAll recoverable attempts by this customer (newest first):`);
  attempts.forEach((a, i) =>
    console.log(`   ${i === 0 ? "→ SHOWN " : "  hidden"} ${a.id}  ${a.status}  ${new Date(a.placedAt).toISOString()}`),
  );

  const willShow =
    Object.values(gates).every(Boolean) && paid.length === 0 && attempts[0]?.id === ID;
  console.log(`\n${willShow ? "✅ THIS ORDER SHOWS on /admin/recovery (Hot carts)." : "❌ THIS ORDER DOES NOT show on /admin/recovery."}`);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
