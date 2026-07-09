/**
 * Sales velocity — real units sold per SKU, for storefront social proof
 * ("16 sold this month") and the earned BESTSELLER badge.
 *
 * READ-ONLY. Touches nothing in the pricing, cart, checkout or analytics
 * paths; this is a reporting query that happens to render on a product card.
 *
 * Two rules keep the numbers honest AND keep us from publishing a competitor's
 * dream spreadsheet:
 *
 *  1. Only fulfilled-ish orders count. A PENDING row is a reservation, not a
 *     sale, and an ABANDONED/FAILED one is the opposite of a sale.
 *  2. Counts below MIN_PUBLIC_UNITS never leave the server. "1 sold this month"
 *     is worse than silence for the buyer and worse than silence for us — and
 *     suppressing it server-side means the number simply isn't in the JSON,
 *     rather than being shipped and hidden with CSS.
 */

import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db";

/** skuId → units sold in the window. Only SKUs at/above the floor appear. */
export type SalesMap = Record<string, number>;

/**
 * Below this, a SKU is simply absent from the map. Set at 5 because the live
 * catalogue's tail (1–4 units/month) reads as "nobody wants this".
 */
export const MIN_PUBLIC_UNITS = 5;

/** Units at/above which a SKU is genuinely moving, not just trickling. */
export const SELLING_FAST_UNITS = 10;

const WINDOW_DAYS = 30;

/**
 * Units sold per SKU over the trailing `days`, suppressed below the floor.
 * Fail-soft: any DB error yields {} so the grid renders without social proof
 * rather than 500-ing a shopping page.
 */
export async function getUnitsSoldBySku(days: number = WINDOW_DAYS): Promise<SalesMap> {
  const window = Math.max(1, Math.min(365, Math.floor(days) || WINDOW_DAYS));
  try {
    const rows = (await db.execute(sql`
      SELECT it->>'skuId'            AS sku_id,
             sum((it->>'qty')::int)::int AS units
      FROM orders o, jsonb_array_elements(o.items) AS it
      WHERE o.placed_at >= now() - make_interval(days => ${window})
        AND o.status IN ('PAID', 'PACKED', 'SHIPPED', 'DELIVERED')
      GROUP BY 1
    `)) as unknown as Array<{ sku_id: string | null; units: number | string | null }>;

    const map: SalesMap = {};
    for (const r of rows) {
      const skuId = r.sku_id;
      const units = Number(r.units) || 0;
      if (skuId && units >= MIN_PUBLIC_UNITS) map[skuId] = units;
    }
    return map;
  } catch {
    return {};
  }
}
