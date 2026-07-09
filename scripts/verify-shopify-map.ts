/**
 * Cross-check: does every PURCHASABLE frontend variant have a matching Shopify
 * variant (by SKU)?  Run: npx tsx scripts/verify-shopify-map.ts <catalog-map.json>
 * Prints any misses (would-break-checkout) and emits the frontend variant map.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { PRODUCTS } from "../src/lib/products";

const mapPath = process.argv[2];
const shop = JSON.parse(readFileSync(mapPath, "utf8")) as Record<
  string,
  { title: string; variants: { variantId: string; color: string; colorSlug: string; sku: string | null; available: boolean }[] }
>;

// index Shopify variants by their SKU string
const bySku = new Map<string, { variantId: string; available: boolean }>();
for (const h of Object.keys(shop)) {
  for (const v of shop[h].variants) {
    if (v.sku) bySku.set(v.sku, { variantId: v.variantId, available: v.available });
  }
}

type Row = { id: string; slug: string; color: string | null; expectSku: string };
const misses: Row[] = [];
const hits: Array<Row & { variantId: string }> = [];
const frontMap: Record<string, string> = {}; // key: `${slug}` or `${slug}|${colorSlug}` -> variantId

let purchasable = 0;
for (const p of PRODUCTS as any[]) {
  if (p.hidden || p.internal) continue;
  const colors: Array<{ slug: string } | null> =
    p.colors && p.colors.length ? p.colors : [null];
  for (const c of colors) {
    purchasable++;
    const expectSku = c ? `${p.slug}-${c.slug}` : p.slug;
    const found = bySku.get(expectSku);
    const row: Row = { id: p.id, slug: p.slug, color: c?.slug ?? null, expectSku };
    if (found) {
      hits.push({ ...row, variantId: found.variantId });
      frontMap[c ? `${p.slug}|${c.slug}` : p.slug] = found.variantId;
    } else {
      misses.push(row);
    }
  }
}

console.log(`Purchasable frontend variants: ${purchasable}`);
console.log(`  ✓ matched to Shopify: ${hits.length}`);
console.log(`  ✗ NO Shopify variant:  ${misses.length}`);
if (misses.length) {
  console.log("\nMISSING (buy button would break):");
  for (const m of misses) console.log(`   ${m.expectSku}   (${m.id} / ${m.color ?? "no-color"})`);
}

// Also flag Shopify variants not referenced by any purchasable frontend variant
const usedSkus = new Set(hits.map((h) => h.expectSku));
const orphanShop = [...bySku.keys()].filter((s) => !usedSkus.has(s));
if (orphanShop.length) {
  console.log(`\nShopify variants NOT used by frontend (${orphanShop.length}): ${orphanShop.join(", ")}`);
}

writeFileSync(new URL("./frontend-variant-map.json", import.meta.url), JSON.stringify(frontMap, null, 2));
console.log(`\n✓ Wrote frontend-variant-map.json (${Object.keys(frontMap).length} keys)`);
