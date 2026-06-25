/**
 * Seed inventory for the 1:16 "Big" series (the /16 storefront) at 25 units
 * each. Colourless SKUs → variant_slug = ''. Idempotent (ON CONFLICT DO
 * NOTHING) so re-running never clobbers stock already decremented by orders.
 *
 * Usage: `npx tsx src/db/seed-inventory-16.ts`
 */

import { sql } from "drizzle-orm";
import { db } from ".";
import { inventory } from "./schema";
import { getStore16Skus } from "../lib/products";

const SITE_ID = "prc";
const STOCK = 25;

async function main() {
  let inserted = 0;
  let skipped = 0;

  for (const sku of getStore16Skus()) {
    const result = await db
      .insert(inventory)
      .values({ siteId: SITE_ID, skuId: sku.id, variantSlug: "", stock: STOCK })
      .onConflictDoNothing()
      .returning({ skuId: inventory.skuId });
    if (result.length > 0) {
      inserted++;
      console.log(`  + ${sku.id} stock=${STOCK}`);
    } else {
      skipped++;
      console.log(`  = ${sku.id} (already seeded — unchanged)`);
    }
  }

  console.log(`\nSeeded 1:16 inventory: ${inserted} new, ${skipped} unchanged.`);
  await db.execute(sql`SELECT 1`);
  process.exit(0);
}

main().catch((err) => {
  console.error("seed-inventory-16 failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
