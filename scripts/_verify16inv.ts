import { db } from "../src/db";
import { inventory } from "../src/db/schema";
import { inArray } from "drizzle-orm";

const SKUS = [
  "drift-inferno",
  "drift-toxic",
  "drift-phantom",
  "drift-carbon",
  "dares-azure",
  "dares-recon",
];

async function main() {
  const rows = await db
    .select()
    .from(inventory)
    .where(inArray(inventory.skuId, SKUS));
  console.log(`1:16 inventory rows: ${rows.length} of ${SKUS.length}\n`);
  for (const r of rows)
    console.log(`  ${r.skuId.padEnd(16)} site=${r.siteId} variant="${r.variantSlug}" stock=${r.stock}`);
  const have = new Set(rows.map((r) => r.skuId));
  const missing = SKUS.filter((s) => !have.has(s));
  console.log(`\nMissing: ${missing.length ? missing.join(", ") : "none ✅"}`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
