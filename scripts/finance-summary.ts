/**
 * READ-ONLY money summary from the orders table.
 *
 * What the DB CAN tell us: order status mix, money collected (prepaid captured +
 * COD delivered + partial-COD fees), money still pending (COD in transit), and
 * what we CHARGED customers for shipping.
 *
 * What it CANNOT: the actual courier cost we PAY Shiprocket (that's in the
 * Shiprocket wallet/passbook, not in our DB) and product COGS — so true profit
 * needs those two numbers added on top.
 *
 *   Run: npx tsx --env-file=.env.local scripts/finance-summary.ts [days]
 */
import { db } from "../src/db";
import { orders } from "../src/db/schema";
import { gte } from "drizzle-orm";
import { sql } from "drizzle-orm";

const DAYS = Number(process.argv[2] || 60);

const inr = (n: number) => "₹" + n.toLocaleString("en-IN");

async function main() {
  const rows = await db
    .select()
    .from(orders)
    .where(gte(orders.placedAt, sql`now() - interval '${sql.raw(String(DAYS))} days'`));

  console.log(`\nMoney summary — last ${DAYS} days (${rows.length} orders)\n${"=".repeat(56)}`);

  // ── status mix ───────────────────────────────────────────────
  const byStatus = new Map<string, { n: number; total: number }>();
  for (const o of rows) {
    const k = o.status;
    const e = byStatus.get(k) ?? { n: 0, total: 0 };
    e.n++;
    e.total += o.totalInr;
    byStatus.set(k, e);
  }
  console.log("\nBy status:");
  for (const [k, v] of [...byStatus.entries()].sort((a, b) => b[1].n - a[1].n))
    console.log(`  ${k.padEnd(26)} ${String(v.n).padStart(3)}   ${inr(v.total)}`);

  // ── realized vs pending money ───────────────────────────────
  const PAID_PREPAID = new Set(["PAID", "PACKED", "SHIPPED", "DELIVERED"]);
  let collected = 0; // money actually in hand
  let pendingCod = 0; // COD shipped/packed but not yet delivered (to be collected)
  let codDelivered = 0;
  let prepaidCaptured = 0;
  let partialCodFees = 0;
  let shippingChargedToCustomers = 0;
  let liveOrders = 0; // not cancelled/abandoned/failed

  for (const o of rows) {
    const dead = ["CANCELLED", "ABANDONED", "FAILED"].includes(o.status);
    if (dead) continue;
    liveOrders++;
    shippingChargedToCustomers += o.shippingInr ?? 0;

    if (o.paymentMethod === "COD") {
      // partial-COD: a confirmation fee was captured upfront
      if ((o.confirmationFeeInr ?? 0) > 0 && o.paymentStatus === "CAPTURED") {
        partialCodFees += o.confirmationFeeInr;
        collected += o.confirmationFeeInr;
      }
      if (o.status === "DELIVERED") {
        // full order value collected on delivery (minus any prepaid fee already counted)
        const rest = o.totalInr - (o.confirmationFeeInr ?? 0);
        codDelivered += o.totalInr;
        collected += rest;
      } else if (["PACKED", "SHIPPED", "PENDING_COD_VERIFICATION"].includes(o.status)) {
        pendingCod += o.totalInr - (o.confirmationFeeInr ?? 0);
      }
    } else {
      // prepaid (UPI/card)
      if (PAID_PREPAID.has(o.status) && o.paymentStatus === "CAPTURED") {
        prepaidCaptured += o.totalInr;
        collected += o.totalInr;
      }
    }
  }

  console.log("\nMoney IN (collected so far):");
  console.log(`  Prepaid captured (UPI/card)   ${inr(prepaidCaptured)}`);
  console.log(`  COD delivered (cash collected) ${inr(codDelivered)}`);
  console.log(`  Partial-COD fees captured      ${inr(partialCodFees)}`);
  console.log(`  ─────────────────────────────`);
  console.log(`  TOTAL COLLECTED                ${inr(collected)}`);

  console.log("\nMoney PENDING:");
  console.log(`  COD in transit (to collect on delivery)  ${inr(pendingCod)}`);

  console.log("\nShipping CHARGED to customers (revenue line, not our cost):");
  console.log(`  ${inr(shippingChargedToCustomers)}  across ${liveOrders} live orders`);

  console.log(`\n${"=".repeat(56)}`);
  console.log("NOT in this DB (need external sources for true profit):");
  console.log("  • Courier SPEND  → Shiprocket wallet/passbook");
  console.log("  • Product COGS   → your purchase cost per unit");
  console.log("  • Razorpay fees  → ~2% + GST on prepaid (Razorpay settlements)");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
