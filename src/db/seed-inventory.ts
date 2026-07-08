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

/** Colourless-SKU default seed stock. 1:16 big cars are stocked shallower. */
function defaultStock(scale: string): number {
  return scale === "1:16" ? 25 : 50;
}

async function main() {
  let inserted = 0;
  let skipped = 0;

  for (const sku of PRODUCTS) {
    // Hidden SKUs are not orderable — seeding them creates orphan rows the
    // admin health page then flags. (ONE single inventory: every orderable
    // SKU, any scale, seeds under SITE_ID "prc".)
    if (sku.hidden) {
      skipped++;
      continue;
    }
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
      const stock = defaultStock(sku.scale);
      const result = await db
        .insert(inventory)
        .values({
          siteId: SITE_ID,
          skuId: sku.id,
          variantSlug: "",
          stock,
        })
        .onConflictDoNothing()
        .returning({ skuId: inventory.skuId });
      if (result.length > 0) {
        inserted++;
        console.log(`  + ${sku.id} stock=${stock}`);
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
