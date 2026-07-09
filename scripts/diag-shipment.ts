/**
 * READ-ONLY: diagnose the two "not in Shiprocket" orders.
 *  - print full shipping address + line lengths for the 400-failing order
 *  - GET the Shiprocket order for the one that has a shiprocket id, to confirm
 *    it truly exists there and show its current status / AWB.
 *   Run: npx tsx --env-file=.env.local scripts/diag-shipment.ts
 */
import { inArray } from "drizzle-orm";
import { db } from "../src/db";
import { orders } from "../src/db/schema";

const API = "https://apiv2.shiprocket.in/v1/external";

async function srToken(): Promise<string> {
  const res = await fetch(`${API}/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email: process.env.SHIPROCKET_EMAIL,
      password: process.env.SHIPROCKET_PASSWORD,
    }),
  });
  const j = (await res.json()) as { token: string };
  return j.token;
}

async function main() {
  const ids = ["PRC-J59RPY6C", "PRC-UBCTYTGP"];
  const rows = await db
    .select({
      id: orders.id,
      shippingAddress: orders.shippingAddress,
      shiprocketOrderId: orders.shiprocketOrderId,
    })
    .from(orders)
    .where(inArray(orders.id, ids));

  for (const r of rows) {
    const a = r.shippingAddress as Record<string, unknown>;
    console.log(`\n===== ${r.id} — shipping address =====`);
    for (const [k, v] of Object.entries(a)) {
      const s = typeof v === "string" ? v : JSON.stringify(v);
      console.log(`  ${k.padEnd(14)}: (${String(s).length}) ${s}`);
    }
    // Shiprocket's rule: address (line1) + address_2 combined <= 190 chars.
    const l1 = String(a.line1 ?? a.address ?? a.addressLine1 ?? "");
    const l2 = String(a.line2 ?? a.address_2 ?? a.addressLine2 ?? a.landmark ?? "");
    console.log(`  >>> line1(${l1.length}) + line2(${l2.length}) = ${l1.length + l2.length} (Shiprocket max 190)`);
  }

  const token = await srToken();
  console.log(`\n===== Shiprocket API check =====`);
  for (const r of rows) {
    if (!r.shiprocketOrderId || r.shiprocketOrderId === "undefined") {
      console.log(`  ${r.id}: no shiprocket id in DB → NOT created there.`);
      continue;
    }
    const res = await fetch(`${API}/orders/show/${r.shiprocketOrderId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const text = await res.text();
    if (!res.ok) {
      console.log(`  ${r.id}: GET orders/show/${r.shiprocketOrderId} → ${res.status}: ${text.slice(0, 200)}`);
      continue;
    }
    const d = JSON.parse(text) as { data?: Record<string, unknown> };
    const o = d.data ?? {};
    console.log(`  ${r.id}: shiprocket #${r.shiprocketOrderId} EXISTS → status="${o.status}" (code ${o.status_code}), awb="${o.awb_data ? JSON.stringify(o.awb_data) : o.awb_code ?? "none"}", channel="${o.channel_order_id}"`);
  }
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
