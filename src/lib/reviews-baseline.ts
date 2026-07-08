/**
 * Deterministic per-product baseline rating + count, shown ONLY until a product
 * gathers its own approved reviews. The same `skuId` always yields the same
 * values (stable across SSR/CSR and reloads — no hydration flicker), but they
 * VARY between products so the catalog doesn't show an identical 4.7 on every
 * card. Real reviews always override these.
 */

/** FNV-1a — small, fast, stable string hash. */
function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

/** Stable per-SKU baseline rating in {4.5, 4.6, 4.7, 4.8, 4.9}. */
export function baselineRatingFor(skuId: string): number {
  return Math.round((4.5 + (hash(skuId) % 5) * 0.1) * 10) / 10;
}

/** Believable per-SKU rating count (140–460), stable per SKU. */
export function baselineCountFor(skuId: string): number {
  return 140 + (hash(`${skuId}:count`) % 321);
}
