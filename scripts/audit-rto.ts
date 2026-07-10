/**
 * READ-ONLY full shipment audit. Writes nothing.
 *
 * Compares EVERY order that has a Shiprocket shipment against Shiprocket's
 * live status. We can't trust the DB or the events table alone: `DELIVERED` is
 * terminal in the sync cron's IN_FLIGHT_STATUSES, so any order the buggy mapper
 * pushed to DELIVERED stopped being polled and can never self-correct.
 *
 * Emits a correction plan as JSON to stdout (last line) for a separate apply
 * step to consume.
 */
import { sql } from "drizzle-orm";
import { db } from "../src/db";
import { getShipmentStatus, mapShiprocketStatus } from "../src/lib/shiprocket";

type OrderStatus = "PACKED" | "SHIPPED" | "DELIVERED" | "RETURNED" | "CANCELLED" | null;

/** Corrected mapping — the delivered test must run LAST (see audit notes). */
function mapFixed(status: string): OrderStatus {
  const s = status.toUpperCase().trim();
  if (!s || s === "UNKNOWN") return null;
  if (s.includes("RTO") || s.includes("RETURN")) return "RETURNED";
  if (s.includes("CANCEL")) return "CANCELLED";
  if (s.includes("UNDELIVERED") || s.includes("UNDELIVERD")) return "SHIPPED";
  if (s.includes("DELIVERED")) return "DELIVERED";
  if (
    s.includes("OUT FOR DELIVERY") || s.includes("SHIPPED") ||
    s.includes("IN TRANSIT") || s.includes("INTRANSIT") ||
    s.includes("PICKED UP") || s.includes("EN-ROUTE")
  ) return "SHIPPED";
  if (
    s.includes("PICKUP SCHEDULED") || s.includes("READY TO SHIP") ||
    s.includes("PICKUP GENERATED") || s.includes("OUT FOR PICKUP") ||
    s.includes("PICKUP EXCEPTION") || s.includes("AWB ASSIGNED")
  ) return "PACKED";
  return null;
}

async function main() {
  const rows = (await db.execute(sql`
    SELECT id, status, payment_method, total_inr,
           shiprocket_shipment_id AS shipment_id, awb_code
    FROM orders
    WHERE shiprocket_shipment_id IS NOT NULL
    ORDER BY placed_at DESC
  `)) as unknown as Array<Record<string, string | number | null>>;

  console.log(`Auditing ${rows.length} shipments against Shiprocket...\n`);
  console.log(
    "ORDER".padEnd(15) + "PAY".padEnd(6) + "₹".padEnd(7) +
    "DB NOW".padEnd(11) + "SHIPROCKET NOW".padEnd(26) + "SHOULD BE",
  );
  console.log("-".repeat(84));

  const plan: Array<Record<string, unknown>> = [];
  const rawSeen = new Map<string, number>();

  for (const o of rows) {
    const shipmentId = o.shipment_id ? String(o.shipment_id) : null;
    if (!shipmentId) continue;

    let live = "ERROR";
    try {
      live = (await getShipmentStatus(shipmentId)).current_status;
    } catch (e) {
      live = `ERROR: ${e instanceof Error ? e.message.slice(0, 30) : e}`;
    }
    rawSeen.set(live, (rawSeen.get(live) ?? 0) + 1);

    const fixed = mapFixed(live);
    const buggy = mapShiprocketStatus(live);
    const needsChange = fixed !== null && fixed !== o.status;

    if (needsChange || buggy !== fixed) {
      console.log(
        String(o.id).padEnd(15) +
          String(o.payment_method).padEnd(6) +
          String(o.total_inr).padEnd(7) +
          String(o.status).padEnd(11) +
          live.slice(0, 25).padEnd(26) +
          String(fixed) + (needsChange ? "   <-- CHANGE" : "   (mapper only)"),
      );
    }
    if (needsChange) {
      plan.push({
        orderId: o.id, from: o.status, to: fixed, live,
        payment: o.payment_method, totalInr: o.total_inr, awb: o.awb_code,
      });
    }
  }

  console.log("\n--- every raw Shiprocket status seen ---");
  for (const [k, v] of [...rawSeen.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(v).padStart(3)}  ${k}   => fixed: ${mapFixed(k)}  | buggy: ${mapShiprocketStatus(k)}`);
  }

  const rtoing = plan.filter((p) => p.to === "RETURNED");
  const codLoss = rtoing
    .filter((p) => p.payment === "COD")
    .reduce((sum, p) => sum + Number(p.totalInr), 0);

  console.log(`\nOrders needing correction: ${plan.length}`);
  console.log(`  -> RETURNED (real RTO): ${rtoing.length}`);
  console.log(`  -> COD value wrongly booked as collected: ₹${codLoss.toLocaleString("en-IN")}`);
  console.log(`\nPLAN_JSON:${JSON.stringify(plan)}`);
  process.exit(0);
}
main().catch((e) => { console.error("THROW:", e instanceof Error ? e.message : e); process.exit(1); });
