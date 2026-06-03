/**
 * Seed the `inventory` table from the in-code PRODUCTS catalog.
 *
 * Idempotent: ON CONFLICT DO NOTHING. Re-running won't overwrite stock that
 * was decremented by real orders. To reset/refresh a row, the operator
 * UPDATEs it directly in the admin or via SQL.
 *
 * Usage: `npm run db:seed-inventory`
 */

import { sql } from "drizzle-orm";
import { db } from ".";
import { inventory } from "./schema";
import { PRODUCTS } from "../lib/products";

const SITE_ID = "prc";

async function main() {
  let inserted = 0;
  let skipped = 0;

  for (const sku of PRODUCTS) {
    if (sku.colors && sku.colors.length > 0) {
      for (const c of sku.colors) {
        const result = await db
          .insert(inventory)
          .values({
            siteId: SITE_ID,
            skuId: sku.id,
            variantSlug: c.slug,
            stock: c.stock,
          })
          .onConflictDoNothing()
          .returning({ skuId: inventory.skuId });
        if (result.length > 0) {
          inserted++;
          console.log(`  + ${sku.id} (${c.slug}) stock=${c.stock}`);
        } else {
          skipped++;
        }
      }
    } else {
      // SKUs without colour variants — single row with variant_slug='' and a
      // generous default stock the operator can flip down.
      const result = await db
        .insert(inventory)
        .values({
          siteId: SITE_ID,
          skuId: sku.id,
          variantSlug: "",
          stock: 50,
        })
        .onConflictDoNothing()
        .returning({ skuId: inventory.skuId });
      if (result.length > 0) {
        inserted++;
        console.log(`  + ${sku.id} stock=50`);
      } else {
        skipped++;
      }
    }
  }

  console.log(`\nSeeded inventory: ${inserted} new rows, ${skipped} unchanged.`);
  // Cleanly exit so the Postgres pool doesn't keep the process alive.
  await db.execute(sql`SELECT 1`);
  process.exit(0);
}

main().catch((err) => {
  console.error("seed-inventory failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
