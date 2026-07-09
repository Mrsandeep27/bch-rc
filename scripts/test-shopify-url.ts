import { buildShopifyCartUrl, shopifyVariantId } from "../src/lib/shopify";

const cases: { name: string; items: { skuId: string; variantSlug: string | null; qty: number }[] }[] = [
  { name: "single colored (BMW blue x1)", items: [{ skuId: "pocket-bmw", variantSlug: "blue", qty: 1 }] },
  { name: "single no-color (cybertruck x2)", items: [{ skuId: "cybertruck-camper", variantSlug: null, qty: 2 }] },
  { name: "multi-item (monster multi x1 + thar black x3)", items: [
    { skuId: "pocket-monster", variantSlug: "multi", qty: 1 },
    { skuId: "pocket-thar", variantSlug: "black", qty: 3 },
  ] },
  { name: "bundle (construction 3-pack x1)", items: [{ skuId: "construction-3pack", variantSlug: null, qty: 1 }] },
  { name: "unknown sku (should skip)", items: [{ skuId: "does-not-exist", variantSlug: null, qty: 1 }] },
];

let ok = true;
for (const c of cases) {
  const url = buildShopifyCartUrl(c.items);
  console.log(`\n${c.name}`);
  for (const i of c.items) console.log(`   ${i.skuId}/${i.variantSlug ?? "—"} x${i.qty} -> ${shopifyVariantId(i.skuId, i.variantSlug) ?? "NO MATCH"}`);
  console.log(`   URL: ${url}`);
  if (c.name.startsWith("unknown") ? url !== null : !/^https:\/\/8yyp1g-0a\.myshopify\.com\/cart\/\d+:\d+/.test(url ?? "")) {
    console.log("   ✗ unexpected"); ok = false;
  } else console.log("   ✓");
}
console.log(ok ? "\n✅ all URL cases pass" : "\n✗ some cases failed");
process.exit(ok ? 0 : 1);
