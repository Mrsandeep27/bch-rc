/**
 * PRC Cars — Real product lineup (replaces Storm placeholder SKUs).
 *
 * All 4 are Trasped/Hengguan HG4-series 1:64 chassis with different body shells.
 * Per-SKU pricing (2026-06-05) — listed `retailINR` is the pre-coupon price; the
 * auto-applied CODEPRC100 (-₹100) brings the customer to the published "from"
 * target: BMW ₹999, Porsche/Thar ₹1,299, F1 Classic ₹1,499, Monster Truck ₹1,799.
 * MRP carries a ~30-35% strikethrough.
 */

export type Scale = "1:64" | "1:43" | "1:24";

export type ColorVariant = {
  /** Display name, e.g. "Blue", "Multi Colour", "Red & Orange" */
  name: string;
  /** Slug used in image filenames + URL query, e.g. "blue", "multi", "red-orange" */
  slug: string;
  /** Swatch fill — solid hex, or "gradient:from,to" / "gradient:from,mid,to" */
  swatch: string;
  /** Units in hand from Syed's warehouse — used for stock badges + sold-out gating */
  stock: number;
  /** Optional variant image. Falls back to sku.heroImage if absent. */
  image?: string;
  /** Per-color additional angle thumbnails. When present, the PDP gallery
   *  shows [color hero, ...altImages] for this swatch. Avoids the AI-mismatch
   *  problem of using shared sku.altImages across colored SKUs. */
  altImages?: string[];
};

export type Sku = {
  id: string;
  slug: string;
  scale: Scale;
  name: string;
  tagline: string;
  retailINR: number;
  mrpINR: number;
  bullets: [string, string, string, string];
  badge?: "MOST GIFTED" | "NEW" | "BESTSELLER" | "PRO";
  bodyShape: string;
  heroImage: string;
  /** Optional web-optimized MP4 (muted, ~6s loop). Plays on hover in SkuLineup. */
  heroVideo?: string;
  altImages: string[];
  /** When true, SKU exists in data but is hidden from the storefront grid
   *  AND returns 404 on the PDP — i.e. "doesn't exist as far as anyone can
   *  reach it". Use for future / discontinued SKUs you want to keep in code
   *  but not expose at all. */
  hidden?: boolean;
  /** When true, SKU is filtered from the storefront grid, sitemap, and
   *  static-params list — but the PDP renders normally for anyone who knows
   *  the slug. Use for internal QA / ops links (₹1 smoke-test SKU, gift
   *  cards for staff, etc.) where you need a live URL but don't want
   *  customers, Google, or the catalog to surface it. */
  internal?: boolean;
  /** Per-color stock + image. Listed in display order. */
  colors?: ColorVariant[];
  specs: {
    lengthMM: number;
    drive: "2WD" | "4WD";
    topSpeedKmh: number;
    batteryMin: number;
    chargeMin: number;
    rangeM: number;
    minAge: number;
    led: string;
    drift: string;
  };
};

export const PRODUCTS: Sku[] = [
  {
    id: "pocket-bmw",
    slug: "pocket-bmw",
    scale: "1:64",
    name: "Pocket BMW",
    tagline: "M-striped racing icon · 2.4 GHz · LED headlights",
    retailINR: 1099,
    mrpINR: 1599,
    bullets: [
      "Die-cast alloy BMW M-style body",
      "2.4 GHz · race 3 cars side-by-side",
      "USB-C · 12-15 min real drift per charge",
      "Drift + grip wheels swappable in seconds",
    ],
    badge: "NEW",
    bodyShape: "BMW M-style sport coupe",
    heroImage: "/products/PRC-bmw-v2.webp",
    heroVideo: "/products/PRC-bmw.mp4",
    altImages: [
      "/products/PRC-bmw-2.webp",
      "/products/PRC-bmw-3.webp",
      "/products/PRC-bmw-4.webp",
    ],
    colors: [
      { name: "White",  slug: "white",  swatch: "#f1f1ef", stock: 35, image: "/products/colors/PRC-bmw-white.webp",
        altImages: ["/products/colors/PRC-bmw-white-2.webp","/products/colors/PRC-bmw-white-3.webp","/products/colors/PRC-bmw-white-4.webp"] },
      { name: "Blue",   slug: "blue",   swatch: "#1d4ed8", stock: 18, image: "/products/colors/PRC-bmw-blue.webp",
        altImages: ["/products/colors/PRC-bmw-blue-2.webp","/products/colors/PRC-bmw-blue-3.webp","/products/colors/PRC-bmw-blue-4.webp"] },
      { name: "Black",  slug: "black",  swatch: "#111827", stock: 16, image: "/products/colors/PRC-bmw-black.webp",
        altImages: ["/products/colors/PRC-bmw-black-2.webp","/products/colors/PRC-bmw-black-3.webp","/products/colors/PRC-bmw-black-4.webp"] },
    ],
    specs: {
      lengthMM: 72,
      drive: "2WD",
      topSpeedKmh: 14,
      batteryMin: 14,
      chargeMin: 30,
      rangeM: 25,
      minAge: 8,
      led: "Tail + Headlight",
      drift: "Yes",
    },
  },
  {
    id: "pocket-porsche",
    slug: "pocket-porsche",
    scale: "1:64",
    name: "Pocket Porsche",
    tagline: "GT3 silhouette · drift wheels · iconic Stuttgart lines",
    retailINR: 1399,
    mrpINR: 1999,
    bullets: [
      "Porsche 911 GT3-inspired die-cast body",
      "Pre-tuned for tight corner drifts",
      "USB-C charge · 30 min full",
      "LED headlights + tail-lights · 7-day replacement",
    ],
    badge: "MOST GIFTED",
    bodyShape: "Porsche 911 GT3-style",
    heroImage: "/products/PRC-porsche.webp",
    heroVideo: "/products/PRC-porsche.mp4",
    altImages: [
      "/products/PRC-porsche-2.webp",
      "/products/PRC-porsche-3.webp",
      "/products/PRC-porsche-4.webp",
    ],
    colors: [
      { name: "Dark Blue",    slug: "dark-blue",    swatch: "#1e3a8a", stock: 18, image: "/products/colors/PRC-porsche-dark-blue.webp",
        altImages: ["/products/colors/PRC-porsche-dark-blue-2.webp","/products/colors/PRC-porsche-dark-blue-3-v2.webp","/products/colors/PRC-porsche-dark-blue-4.webp"] },
      { name: "Green",        slug: "green",        swatch: "#16a34a", stock: 18, image: "/products/colors/PRC-porsche-green-v2.webp",
        altImages: ["/products/colors/PRC-porsche-green-2-v2.webp","/products/colors/PRC-porsche-green-3-v2.webp","/products/colors/PRC-porsche-green-4-v2.webp"] },
      { name: "Yellow",       slug: "yellow",       swatch: "#facc15", stock: 18, image: "/products/colors/PRC-porsche-yellow.webp",
        altImages: ["/products/colors/PRC-porsche-yellow-2.webp","/products/colors/PRC-porsche-yellow-3.webp","/products/colors/PRC-porsche-yellow-4.webp"] },
      { name: "Multi Colour", slug: "multi",        swatch: "gradient:#f97316,#facc15,#16a34a,#2563eb", stock: 18, image: "/products/colors/PRC-porsche-multi.webp",
        altImages: ["/products/colors/PRC-porsche-multi-2.webp","/products/colors/PRC-porsche-multi-3.webp","/products/colors/PRC-porsche-multi-4.webp"] },
    ],
    specs: {
      lengthMM: 70,
      drive: "2WD",
      topSpeedKmh: 15,
      batteryMin: 15,
      chargeMin: 30,
      rangeM: 28,
      minAge: 8,
      led: "Tail + Headlight",
      drift: "Pro drift mode",
    },
  },
  {
    id: "pocket-thar",
    slug: "pocket-thar",
    scale: "1:64",
    name: "Pocket Thar",
    tagline: "Off-road champ · grippy treads · made for Indian roads",
    retailINR: 1399,
    mrpINR: 1999,
    bullets: [
      "Mahindra Thar-style off-road body",
      "Grippy treaded tyres for marble + tile",
      "USB-C · 12-15 min real drift per charge",
      "LED headlights · drop-tested 1.2m",
    ],
    badge: "BESTSELLER",
    bodyShape: "Mahindra Thar-style SUV",
    heroImage: "/products/PRC-thar.webp",
    altImages: [
      "/products/PRC-thar-2.webp",
      "/products/PRC-thar-3.webp",
      "/products/PRC-thar-4.webp",
    ],
    colors: [
      { name: "Blue",   slug: "blue",   swatch: "#2563eb", stock: 11, image: "/products/colors/PRC-thar-blue.webp",
        altImages: ["/products/colors/PRC-thar-blue-2.webp","/products/colors/PRC-thar-blue-3.webp","/products/colors/PRC-thar-blue-4.webp"] },
      { name: "Yellow", slug: "yellow", swatch: "#facc15", stock:  8, image: "/products/colors/PRC-thar-yellow.webp",
        altImages: ["/products/colors/PRC-thar-yellow-2.webp","/products/colors/PRC-thar-yellow-3.webp","/products/colors/PRC-thar-yellow-4.webp"] },
      { name: "White",  slug: "white",  swatch: "#f1f1ef", stock:  5, image: "/products/colors/PRC-thar-white.webp",
        altImages: ["/products/colors/PRC-thar-white-2.webp","/products/colors/PRC-thar-white-3.webp","/products/colors/PRC-thar-white-4.webp"] },
      { name: "Black",  slug: "black",  swatch: "#111827", stock:  1, image: "/products/colors/PRC-thar-black.webp",
        altImages: ["/products/colors/PRC-thar-black-2.webp","/products/colors/PRC-thar-black-3.webp","/products/colors/PRC-thar-black-4.webp"] },
    ],
    specs: {
      lengthMM: 75,
      drive: "2WD",
      topSpeedKmh: 13,
      batteryMin: 15,
      chargeMin: 30,
      rangeM: 25,
      minAge: 8,
      led: "Headlight",
      drift: "Off-road grip",
    },
  },
  {
    id: "pocket-monster",
    slug: "pocket-monster",
    scale: "1:64",
    name: "Pocket Monster Truck",
    tagline: "Oversized wheels · 4WD · climbs anything · LED roof bar",
    retailINR: 1899,
    mrpINR: 2699,
    bullets: [
      "Massive over-scaled rubber wheels",
      "4WD drive · climbs cushions, books, steps",
      "LED roof light-bar + headlights",
      "USB-C · 25 min runtime · 7-day replacement",
    ],
    badge: "PRO",
    bodyShape: "Monster Truck oversize chassis",
    heroImage: "/products/PRC-monster.webp",
    heroVideo: "/products/PRC-monster.mp4",
    altImages: [
      "/products/PRC-monster-2.webp",
      "/products/PRC-monster-3.webp",
      "/products/PRC-monster-4.webp",
    ],
    colors: [
      { name: "Blue",           slug: "blue",        swatch: "#2563eb", stock: 11, image: "/products/colors/PRC-monster-blue.webp",
        altImages: ["/products/colors/PRC-monster-blue-2.webp","/products/colors/PRC-monster-blue-3.webp","/products/colors/PRC-monster-blue-4.webp"] },
      { name: "Yellow",         slug: "yellow",      swatch: "#facc15", stock: 11, image: "/products/colors/PRC-monster-yellow.webp",
        altImages: ["/products/colors/PRC-monster-yellow-2.webp","/products/colors/PRC-monster-yellow-3.webp","/products/colors/PRC-monster-yellow-4.webp"] },
      { name: "White & Red",    slug: "white-red",   swatch: "gradient:#f8fafc,#dc2626", stock: 11, image: "/products/colors/PRC-monster-white-red.webp",
        altImages: ["/products/colors/PRC-monster-white-red-2.webp","/products/colors/PRC-monster-white-red-3.webp","/products/colors/PRC-monster-white-red-4.webp"] },
      { name: "Multi Colour",   slug: "multi",       swatch: "gradient:#f97316,#facc15,#16a34a,#2563eb", stock: 11, image: "/products/colors/PRC-monster-multi.webp",
        altImages: ["/products/colors/PRC-monster-multi-2.webp","/products/colors/PRC-monster-multi-3.webp","/products/colors/PRC-monster-multi-4.webp"] },
      { name: "Red & Orange",   slug: "red-orange",  swatch: "gradient:#dc2626,#f97316", stock: 12, image: "/products/colors/PRC-monster-red-orange.webp",
        altImages: ["/products/colors/PRC-monster-red-orange-2.webp","/products/colors/PRC-monster-red-orange-3.webp","/products/colors/PRC-monster-red-orange-4.webp"] },
    ],
    specs: {
      lengthMM: 85,
      drive: "4WD",
      topSpeedKmh: 12,
      batteryMin: 18,
      chargeMin: 35,
      rangeM: 25,
      minAge: 8,
      led: "Roof bar + Headlight",
      drift: "All-terrain grip",
    },
  },

  // ---- Scraped competitor SKU variants (Trasped HG4 family) ----
  // Sourced from Indian competitor research (REF_1_64_COMPETITOR_PRODUCTS.md).
  // Same chassis as above; different bodies → different model numbers.

  {
    id: "pocket-f1-classic",
    slug: "pocket-f1-classic",
    scale: "1:64",
    name: "Pocket F1 Classic",
    tagline: "Formula racing silhouette · entry-grade · most popular",
    retailINR: 1599,
    mrpINR: 2299,
    bullets: [
      "Trasped HG4-218 Formula 1 generic body",
      "2.4 GHz · 3-speed adjustable",
      "USB-C · 12-15 min real drift per charge",
      "LED headlights · drift wheels included",
    ],
    bodyShape: "F1 generic open-wheel",
    heroImage: "/products/PRC-f1-classic.webp",
    altImages: [
      "/products/PRC-f1-classic-2.webp",
      "/products/PRC-f1-classic-3.webp",
      "/products/PRC-f1-classic-4.webp",
    ],
    colors: [
      { name: "White", slug: "white", swatch: "#f1f1ef", stock: 36, image: "/products/colors/PRC-f1-classic-white.webp",
        altImages: ["/products/colors/PRC-f1-classic-white-2.webp","/products/colors/PRC-f1-classic-white-3.webp","/products/colors/PRC-f1-classic-white-4.webp"] },
      { name: "Red",   slug: "red",   swatch: "#dc2626", stock: 36, image: "/products/colors/PRC-f1-classic-red.webp",
        altImages: ["/products/colors/PRC-f1-classic-red-2.webp","/products/colors/PRC-f1-classic-red-3.webp","/products/colors/PRC-f1-classic-red-4.webp"] },
    ],
    specs: {
      lengthMM: 70,
      drive: "2WD",
      topSpeedKmh: 14,
      batteryMin: 14,
      chargeMin: 25,
      rangeM: 25,
      minAge: 8,
      led: "Headlight",
      drift: "Yes",
    },
  },
  {
    id: "pocket-f1-ferrari",
    slug: "pocket-f1-ferrari",
    scale: "1:64",
    name: "Pocket F1 Ferrari White",
    tagline: "Ferrari-livery aero · white edition · race-detail body",
    retailINR: 1299,
    mrpINR: 1999,
    bullets: [
      "Trasped HG4-234 Ferrari-style F1 in white",
      "Detailed aero kit + exposed wheels",
      "2.4 GHz · race 3 cars side-by-side",
      "USB-C · LED headlights · drift wheels swap",
    ],
    bodyShape: "Ferrari-style F1, white livery",
    hidden: true,
    heroImage: "/products/PRC-f1-ferrari.webp",
    altImages: [
      "/products/PRC-f1-ferrari-2.webp",
      "/products/PRC-f1-ferrari-3.webp",
      "/products/PRC-f1-ferrari-4.webp",
    ],
    specs: {
      lengthMM: 70,
      drive: "2WD",
      topSpeedKmh: 15,
      batteryMin: 15,
      chargeMin: 30,
      rangeM: 25,
      minAge: 8,
      led: "Tail + Headlight",
      drift: "Yes",
    },
  },
  {
    id: "pocket-beetle",
    slug: "pocket-beetle",
    scale: "1:64",
    name: "Pocket Beetle",
    tagline: "Round-body classic · pocket-friendly drift · iconic curves",
    retailINR: 1299,
    mrpINR: 1999,
    bullets: [
      "Trasped HG4-216 Beetle-style body",
      "Smooth drift on tile + marble",
      "USB-C · 12-15 min real drift per charge",
      "LED tail-lights · age 6+ friendly",
    ],
    bodyShape: "VW Beetle-style round-roof",
    hidden: true,
    heroImage: "/products/PRC-beetle.webp",
    altImages: [
      "/products/PRC-beetle-2.webp",
      "/products/PRC-beetle-3.webp",
      "/products/PRC-beetle-4.webp",
    ],
    specs: {
      lengthMM: 68,
      drive: "2WD",
      topSpeedKmh: 12,
      batteryMin: 14,
      chargeMin: 25,
      rangeM: 22,
      minAge: 6,
      led: "Tail-light",
      drift: "Yes",
    },
  },
  {
    id: "pocket-f1-driver",
    slug: "pocket-f1-driver",
    scale: "1:64",
    name: "Pocket F1 + Driver",
    tagline: "Premium tier · with mounted driver figurine · collector grade",
    retailINR: 1899,
    mrpINR: 2699,
    bullets: [
      "F1 Leclerc-style body with seated driver figurine",
      "Higher-detail livery + collector finish",
      "Same Trasped 2.4 GHz drift chassis",
      "Premium gift box · display-ready",
    ],
    badge: "PRO",
    bodyShape: "F1 Leclerc-style with driver",
    hidden: true,
    heroImage: "/products/PRC-f1-driver.webp",
    altImages: [
      "/products/PRC-f1-driver-2.webp",
      "/products/PRC-f1-driver-3.webp",
      "/products/PRC-f1-driver-4.webp",
    ],
    specs: {
      lengthMM: 72,
      drive: "2WD",
      topSpeedKmh: 15,
      batteryMin: 15,
      chargeMin: 30,
      rangeM: 28,
      minAge: 8,
      led: "Tail + Headlight",
      drift: "Pro drift mode",
    },
  },
  // -----------------------------------------------------------------------
  // INTERNAL QA SKU — accessible via /product/qa-1rs but excluded from the
  // catalog, sitemap, and static params. Priced so that subtotal (₹16) plus
  // shipping (₹85, no free-ship since <₹1099) minus the UPI prepaid
  // discount (₹100) lands exactly at ₹1. Use for end-to-end live smoke
  // tests without burning ₹1,299 per attempt. Stock is seeded by
  // src/db/seed-inventory.ts with variant_slug = ''.
  // -----------------------------------------------------------------------
  {
    id: "qa-1rs",
    slug: "qa-1rs",
    scale: "1:64",
    name: "QA — Test Purchase ₹1",
    tagline: "Internal smoke-test SKU — DO NOT FULFIL",
    retailINR: 16,
    mrpINR: 16,
    bullets: [
      "Internal QA only — do not ship",
      "Buy via UPI to land at ₹1 total",
      "Refund the payment in Razorpay after the test",
      "Hidden from catalog, sitemap, and search",
    ],
    bodyShape: "n/a — diagnostic SKU",
    internal: true,
    heroImage: "/products/PRC-bmw.webp",
    altImages: [],
    specs: {
      lengthMM: 0,
      drive: "2WD",
      topSpeedKmh: 0,
      batteryMin: 0,
      chargeMin: 0,
      rangeM: 0,
      minAge: 0,
      led: "n/a",
      drift: "n/a",
    },
  },
];

export const HERO_SKU_ID = "pocket-porsche";

export function getProductById(id: string): Sku | undefined {
  return PRODUCTS.find((p) => p.id === id);
}

/** Storefront grid — excludes anything flagged `hidden`. */
export function getVisibleProducts(): Sku[] {
  return PRODUCTS.filter((p) => !p.hidden && !p.internal);
}

export function getHeroSku(): Sku {
  return PRODUCTS.find((p) => p.id === HERO_SKU_ID)!;
}

/** Sum of stock across all color variants. Falls back to 0 if no variants. */
export function totalStock(sku: Sku): number {
  if (!sku.colors?.length) return 0;
  return sku.colors.reduce((sum, c) => sum + c.stock, 0);
}

/**
 * Default variant slug for quick-add CTAs (Hero, FinalCta, sticky bars, bundle).
 * Picks the first IN-STOCK color, falls back to the first color, falls back
 * to null for SKUs without colors. The PDP color picker can always override.
 */
export function defaultVariantSlug(sku: Sku): string | null {
  if (!sku.colors?.length) return null;
  return sku.colors.find((c) => c.stock > 0)?.slug ?? sku.colors[0].slug;
}

export const WHOLESALE_TIERS = [
  { id: "starter", label: "Starter", moq: 12, discountPct: 35 },
  { id: "standard", label: "Standard", moq: 48, discountPct: 45 },
  { id: "distributor", label: "Distributor", moq: 144, discountPct: 52 },
] as const;

export function tradePerUnit(mrp: number, discountPct: number): number {
  return Math.round(mrp * (1 - discountPct / 100));
}

export function tradeMarginPerUnit(
  mrp: number,
  discountPct: number,
  landingCost: number
): number {
  return tradePerUnit(mrp, discountPct) - landingCost;
}
