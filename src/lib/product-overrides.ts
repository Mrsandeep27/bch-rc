/**
 * Product overrides — the admin-editable layer over the code catalogue.
 *
 * The catalogue itself lives in code (src/lib/products.ts). The admin can layer
 * a small DB override (price / MRP / visibility / badge) on top of any SKU
 * WITHOUT migrating the whole catalogue. Reads here ALWAYS fall back to an empty
 * override on any error (missing table before the migration is applied, DB
 * blip), so the storefront and checkout keep working exactly as before until an
 * override actually exists. Money stays consistent because every price consumer
 * (PDP display + the order-create pricing seam) reads the SAME merged value.
 */

import { inArray, eq } from "drizzle-orm";
import { db } from "@/db";
import { productOverrides } from "@/db/schema";
import type { Sku } from "@/lib/products";

export type ProductOverride = {
  skuId: string;
  priceInr: number | null;
  mrpInr: number | null;
  hidden: boolean | null;
  comingSoon: boolean | null;
  badge: string | null;
};

const COLS = {
  skuId: productOverrides.skuId,
  priceInr: productOverrides.priceInr,
  mrpInr: productOverrides.mrpInr,
  hidden: productOverrides.hidden,
  comingSoon: productOverrides.comingSoon,
  badge: productOverrides.badge,
} as const;

/** All overrides (optionally site-scoped), keyed by SKU id. Empty on any error. */
export async function getOverrideMap(
  siteIds?: string[],
): Promise<Map<string, ProductOverride>> {
  try {
    const base = db.select(COLS).from(productOverrides);
    const rows =
      siteIds && siteIds.length
        ? await base.where(inArray(productOverrides.siteId, siteIds))
        : await base;
    const m = new Map<string, ProductOverride>();
    for (const r of rows) m.set(r.skuId, r as ProductOverride);
    return m;
  } catch {
    return new Map();
  }
}

/** Override for a single SKU (used by the PDP). Undefined on any error. */
export async function getOverrideForSku(
  skuId: string,
): Promise<ProductOverride | undefined> {
  try {
    const [r] = await db
      .select(COLS)
      .from(productOverrides)
      .where(eq(productOverrides.skuId, skuId))
      .limit(1);
    return r ? (r as ProductOverride) : undefined;
  } catch {
    return undefined;
  }
}

/** Merge an override onto a code SKU. Null fields keep the code value. */
export function applyOverride(sku: Sku, ov?: ProductOverride): Sku {
  if (!ov) return sku;
  return {
    ...sku,
    retailINR: ov.priceInr ?? sku.retailINR,
    mrpINR: ov.mrpInr ?? sku.mrpINR,
    hidden: ov.hidden ?? sku.hidden,
    comingSoon: ov.comingSoon ?? sku.comingSoon,
    // badge: "" from the admin clears it; null keeps the code badge.
    badge:
      ov.badge === null
        ? sku.badge
        : ov.badge === ""
          ? undefined
          : (ov.badge as Sku["badge"]),
  };
}

/** Apply a whole override map to a list of code SKUs. */
export function applyOverrides(
  skus: Sku[],
  map: Map<string, ProductOverride>,
): Sku[] {
  if (map.size === 0) return skus;
  return skus.map((s) => applyOverride(s, map.get(s.id)));
}

/** The single authoritative unit price for a SKU (code price + override). */
export function effectivePrice(sku: Sku, ov?: ProductOverride): number {
  return ov?.priceInr ?? sku.retailINR;
}
