import { notFound } from "next/navigation";
import { and, eq, inArray } from "drizzle-orm";
import { requireAdmin } from "@/lib/admin-auth";
import { db } from "@/db";
import { inventory } from "@/db/schema";
import { PRODUCTS, type Sku } from "@/lib/products";
import { HUB_CATEGORIES } from "@/lib/hub-categories";
import { getOverrideForSku, applyOverride } from "@/lib/product-overrides";
import ProductEditor, { type ProductDetail } from "./ProductEditor";

export const dynamic = "force-dynamic";

const CAT_LABEL = new Map(HUB_CATEGORIES.map((c) => [c.key, c.label]));

function categoryKeyOf(sku: Sku): string {
  if (sku.category === "polo") return "polo";
  if (sku.category === "construction") return "construction";
  if (sku.scale === "1:16") return "big16";
  if (sku.scale === "1:20") return "s20";
  return "mini64";
}

function statusOf(p: Sku): ProductDetail["status"] {
  if (p.hidden) return "hidden";
  if (p.comingSoon) return "coming";
  return "active";
}

export default async function AdminProductEdit({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await requireAdmin();
  const { id } = await params;

  const base = PRODUCTS.find((p) => p.id === id);
  if (!base) notFound();

  // Layer any admin override on top of the code SKU so the editor shows the
  // current effective price / MRP / visibility / badge (empty before migration).
  const ov = await getOverrideForSku(id);
  const sku = applyOverride(base, ov);

  // Live per-variant stock for this SKU. A variant with no row is "no data"
  // (null) — distinct from a real 0 — so the editor can create it via `set`.
  const rows = ctx.siteIds.length
    ? await db
        .select({ variantSlug: inventory.variantSlug, stock: inventory.stock })
        .from(inventory)
        .where(and(inArray(inventory.siteId, ctx.siteIds), eq(inventory.skuId, id)))
    : [];
  const stockByVariant = new Map(rows.map((r) => [r.variantSlug, r.stock]));

  const colors = sku.colors ?? [];
  const variants: ProductDetail["variants"] = colors.length
    ? colors.map((c) => ({
        slug: c.slug,
        name: c.name,
        swatch: c.swatch,
        image: c.image ?? sku.heroImage,
        stock: stockByVariant.has(c.slug) ? stockByVariant.get(c.slug) ?? null : null,
      }))
    : [
        {
          slug: "",
          name: "Default",
          swatch: null,
          image: sku.heroImage,
          stock: stockByVariant.has("") ? stockByVariant.get("") ?? null : null,
        },
      ];

  const key = categoryKeyOf(sku);
  const detail: ProductDetail = {
    id: sku.id,
    slug: sku.slug,
    name: sku.name,
    tagline: sku.tagline,
    description: sku.bullets.join(" · "),
    scale: sku.scale,
    categoryLabel: CAT_LABEL.get(key) ?? key,
    badge: sku.badge ?? null,
    retailINR: sku.retailINR,
    mrpINR: sku.mrpINR,
    heroImage: sku.heroImage,
    status: statusOf(sku),
    overridden: !!ov,
    variants,
  };

  return <ProductEditor detail={detail} />;
}
