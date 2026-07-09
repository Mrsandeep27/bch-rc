import { inArray } from "drizzle-orm";
import { requireAdmin } from "@/lib/admin-auth";
import { db } from "@/db";
import { inventory } from "@/db/schema";
import { PRODUCTS, type Sku } from "@/lib/products";
import { HUB_CATEGORIES } from "@/lib/hub-categories";
import { getOverrideMap, applyOverrides } from "@/lib/product-overrides";
import ProductsBrowser, { type ProductCard } from "./ProductsBrowser";

export const dynamic = "force-dynamic";

const CAT_LABEL = new Map(HUB_CATEGORIES.map((c) => [c.key, c.label]));

/** Same taxonomy as the storefront + Inventory page: polo/construction are
 *  explicit overrides, otherwise scale decides (1:16→big16, 1:20→s20, else
 *  mini64). Guarantees every SKU lands under exactly one category chip. */
function categoryKeyOf(sku: Sku): string {
  if (sku.category === "polo") return "polo";
  if (sku.category === "construction") return "construction";
  if (sku.scale === "1:16") return "big16";
  if (sku.scale === "1:20") return "s20";
  return "mini64";
}

function statusOf(p: Sku): ProductCard["status"] {
  if (p.hidden) return "hidden";
  if (p.comingSoon) return "coming";
  return "active";
}

export default async function AdminProducts() {
  const ctx = await requireAdmin();

  // Live stock per SKU — sum every variant row up to its SKU. A SKU with zero
  // rows is "no data" (honest), distinct from a summed 0 (genuinely sold out).
  const invRows = ctx.siteIds.length
    ? await db
        .select({ skuId: inventory.skuId, stock: inventory.stock })
        .from(inventory)
        .where(inArray(inventory.siteId, ctx.siteIds))
    : [];
  const stockBySku = new Map<string, number>();
  const hasRow = new Set<string>();
  for (const r of invRows) {
    stockBySku.set(r.skuId, (stockBySku.get(r.skuId) ?? 0) + r.stock);
    hasRow.add(r.skuId);
  }

  // Layer admin overrides (price / visibility / badge) over the code catalogue.
  const overrideMap = await getOverrideMap(ctx.siteIds);
  const products: ProductCard[] = applyOverrides(PRODUCTS, overrideMap).map((p) => {
    const key = categoryKeyOf(p);
    return {
      id: p.id,
      slug: p.slug,
      name: p.name,
      heroImage: p.heroImage,
      scale: p.scale,
      categoryKey: key,
      categoryLabel: CAT_LABEL.get(key) ?? key,
      retailINR: p.retailINR,
      mrpINR: p.mrpINR,
      status: statusOf(p),
      colors: (p.colors ?? []).map((c) => ({ name: c.name, slug: c.slug, swatch: c.swatch })),
      stock: hasRow.has(p.id) ? stockBySku.get(p.id) ?? 0 : null,
    };
  });

  return (
    <div className="space-y-3 sm:space-y-4">
      <div>
        <h1 className="font-display text-lg sm:text-xl font-bold text-brand-ink">Products</h1>
        <p className="text-sm text-brand-ink-soft mt-1">
          Browse the catalogue by category. Stock is live from the inventory table.
        </p>
      </div>

      <ProductsBrowser
        products={products}
        categories={HUB_CATEGORIES.map((c) => ({ key: c.key, label: c.label, img: c.img }))}
      />
    </div>
  );
}
