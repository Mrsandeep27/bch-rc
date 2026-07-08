/**
 * One-off: dump the hub catalog to scratchpad/catalog.json for the Shopify
 * Admin API loader. No secrets here — pure data extraction from the codebase.
 */
import {
  getHubMiniSkus,
  getHubBig16Skus,
  getHub20Skus,
  getHubConstructionSkus,
  getHubPoloSkus,
  getConstructionBundle,
  type Sku,
} from "@/lib/products";
import { THEME } from "@/lib/theme";
import { calcDiscountPct } from "@/lib/utils";
import { writeFileSync } from "node:fs";

const CATS: Array<{ tag: string; collection: string; skus: Sku[] }> = [
  { tag: "mini-rc", collection: "Mini RC · 1:64", skus: getHubMiniSkus() },
  { tag: "big-drift", collection: "Big Drift · 1:16", skus: getHubBig16Skus() },
  { tag: "scale-1-20", collection: "1:20 Scale", skus: getHub20Skus() },
  { tag: "construction", collection: "Construction", skus: getHubConstructionSkus() },
  { tag: "polo", collection: "Polo", skus: getHubPoloSkus() },
];

const seen = new Set<string>();
const products: any[] = [];

function push(sku: Sku, tag: string) {
  if (seen.has(sku.id)) {
    // already added under another category — just add the extra tag later
    const p = products.find((x) => x.id === sku.id);
    if (p && !p.tags.includes(tag)) p.tags.push(tag);
    return;
  }
  seen.add(sku.id);
  const online = sku.retailINR - THEME.prepaidDiscountINR;
  products.push({
    id: sku.id,
    handle: sku.slug,
    title: sku.name,
    tagline: sku.tagline,
    bullets: sku.bullets,
    scale: sku.scale,
    badge: sku.badge ?? null,
    price: sku.retailINR, // COD / base price
    onlinePrice: online, // prepaid price (for reference / discount)
    compareAt: sku.mrpINR,
    discountPct: calcDiscountPct(sku.mrpINR, sku.retailINR),
    tags: [tag, sku.scale],
    heroImage: sku.heroImage,
    altImages: sku.altImages ?? [],
    colors: (sku.colors ?? []).map((c) => ({
      name: c.name,
      slug: c.slug,
      stock: c.stock,
      image: c.image ?? null,
      altImages: c.altImages ?? [],
    })),
    specs: sku.specs,
    bundle: sku.bundle ?? false,
  });
}

for (const cat of CATS) {
  for (const sku of cat.skus) {
    if (sku.hidden || sku.internal || sku.comingSoon) continue;
    push(sku, cat.tag);
  }
}

// Construction 3-Pack bundle (own CTA, but still a real purchasable product)
const bundle = getConstructionBundle();
if (bundle) push(bundle, "construction");

const out = {
  generatedAt: "extract",
  collections: CATS.map((c) => ({ tag: c.tag, title: c.collection })),
  products,
};

const dest =
  "C:/Users/H/AppData/Local/Temp/claude/c--Users-H-Documents-GitHub-bch-rc/42cd0f9d-da46-41a8-ba5d-3c79d032c61e/scratchpad/catalog.json";
writeFileSync(dest, JSON.stringify(out, null, 2));
console.log("products:", products.length);
console.log("sample:", JSON.stringify(products[0], null, 2).slice(0, 700));
