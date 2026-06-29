import { db } from "../src/db";
import { funnelEvents } from "../src/db/schema";
import { sql } from "drizzle-orm";

// Match anything on the 1:16 store: /16 pages, the store=16 checkout, or any
// event whose metadata.skuId is a 1:16 SKU.
const SKUS = ["drift-inferno","drift-toxic","drift-phantom","drift-carbon","dares-azure","dares-recon"];

async function main() {
  const skuList = sql.join(SKUS.map((s) => sql`${s}`), sql`, `);
  const is16 = sql`(${funnelEvents.path} like '/16%' or ${funnelEvents.path} like '%store=16%' or (${funnelEvents.metadata} ->> 'skuId') in (${skuList}))`;

  // events broken down by type: total events + distinct visitors
  const byType = await db
    .select({
      type: funnelEvents.type,
      events: sql<number>`count(*)::int`,
      visitors: sql<number>`count(distinct ${funnelEvents.visitorId})::int`,
    })
    .from(funnelEvents)
    .where(sql`${is16} and ${funnelEvents.isBot} = false`)
    .groupBy(funnelEvents.type);

  console.log("1:16 store — funnel events by type (humans only):\n");
  const order = ["page_view","product_view","add_to_cart","view_cart","checkout_started","payment_method_selected","order_submitted","razorpay_opened","payment_succeeded","payment_failed","purchase"];
  const map = new Map(byType.map((r) => [r.type, r]));
  for (const t of order) {
    const r = map.get(t);
    if (r) console.log(`  ${t.padEnd(24)} events=${String(r.events).padStart(4)}  visitors=${r.visitors}`);
  }
  for (const r of byType) if (!order.includes(r.type)) console.log(`  ${r.type.padEnd(24)} events=${String(r.events).padStart(4)}  visitors=${r.visitors}`);

  // headline: distinct visitors who showed real buy intent (cart or checkout)
  const intent = await db
    .select({ visitors: sql<number>`count(distinct ${funnelEvents.visitorId})::int` })
    .from(funnelEvents)
    .where(sql`${is16} and ${funnelEvents.isBot} = false and ${funnelEvents.type} in ('add_to_cart','checkout_started')`);

  console.log(`\n>>> Distinct people who tried to buy 1:16 (added to cart or started checkout): ${intent[0].visitors}`);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
