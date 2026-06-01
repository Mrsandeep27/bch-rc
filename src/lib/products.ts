/**
 * PRC Cars — Real product lineup (replaces Storm placeholder SKUs).
 *
 * All 4 are Trasped/Hengguan HG4-series 1:64 chassis with different body shells.
 * Pricing follows competitor median research: ₹1,299 sell / ₹1,999 MRP / 35% off.
 * Monster Truck premium tier at ₹1,499 / ₹2,299 (bigger chassis, 4WD).
 */

export type Scale = "1:64" | "1:43" | "1:24";

export type Sku = {
  id: string;
  slug: string;
  scale: Scale;
  name: string;
  tagline: string;
  retailINR: number;
  mrpINR: number;
  landingCostINR: number;
  bullets: [string, string, string, string];
  badge?: "MOST GIFTED" | "NEW" | "BESTSELLER" | "PRO";
  bodyShape: string;
  heroImage: string;
  /** Optional web-optimized MP4 (muted, ~6s loop). Plays on hover in SkuLineup. */
  heroVideo?: string;
  altImages: string[];
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
    retailINR: 1299,
    mrpINR: 1999,
    landingCostINR: 550,
    bullets: [
      "Die-cast alloy BMW M-style body",
      "2.4 GHz · race 3 cars side-by-side",
      "USB-C · 20-min drift time per charge",
      "Drift + grip wheels swappable in seconds",
    ],
    badge: "NEW",
    bodyShape: "BMW M-style sport coupe",
    heroImage: "/products/PRC-bmw.jpg",
    heroVideo: "/products/PRC-bmw.mp4",
    altImages: [
      "/products/PRC-bmw-2.jpg",
      "/products/PRC-bmw-3.jpg",
      "/products/PRC-bmw-4.jpg",
    ],
    specs: {
      lengthMM: 72,
      drive: "2WD",
      topSpeedKmh: 14,
      batteryMin: 20,
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
    retailINR: 1299,
    mrpINR: 1999,
    landingCostINR: 550,
    bullets: [
      "Porsche 911 GT3-inspired die-cast body",
      "Pre-tuned for tight corner drifts",
      "USB-C charge · 30 min full",
      "LED headlights + tail · BIS certified",
    ],
    badge: "MOST GIFTED",
    bodyShape: "Porsche 911 GT3-style",
    heroImage: "/products/PRC-porsche.jpg",
    heroVideo: "/products/PRC-porsche.mp4",
    altImages: [
      "/products/PRC-porsche-2.jpg",
      "/products/PRC-porsche-3.jpg",
      "/products/PRC-porsche-4.jpg",
    ],
    specs: {
      lengthMM: 70,
      drive: "2WD",
      topSpeedKmh: 15,
      batteryMin: 22,
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
    retailINR: 1299,
    mrpINR: 1999,
    landingCostINR: 600,
    bullets: [
      "Mahindra Thar-style off-road body",
      "Grippy treaded tyres for marble + tile",
      "USB-C · 20-min runtime",
      "LED headlights · drop-tested 1.2m",
    ],
    badge: "BESTSELLER",
    bodyShape: "Mahindra Thar-style SUV",
    heroImage: "/products/PRC-thar.jpg",
    altImages: [
      "/products/PRC-thar-2.jpg",
      "/products/PRC-thar-3.jpg",
      "/products/PRC-thar-4.jpg",
    ],
    specs: {
      lengthMM: 75,
      drive: "2WD",
      topSpeedKmh: 13,
      batteryMin: 22,
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
    retailINR: 1499,
    mrpINR: 2299,
    landingCostINR: 700,
    bullets: [
      "Massive over-scaled rubber wheels",
      "4WD drive · climbs cushions, books, steps",
      "LED roof light-bar + headlights",
      "USB-C · 25 min runtime · BIS certified",
    ],
    badge: "PRO",
    bodyShape: "Monster Truck oversize chassis",
    heroImage: "/products/PRC-monster.jpg",
    heroVideo: "/products/PRC-monster.mp4",
    altImages: [
      "/products/PRC-monster-2.jpg",
      "/products/PRC-monster-3.jpg",
      "/products/PRC-monster-4.jpg",
    ],
    specs: {
      lengthMM: 85,
      drive: "4WD",
      topSpeedKmh: 12,
      batteryMin: 25,
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
    retailINR: 1199,
    mrpINR: 1799,
    landingCostINR: 500,
    bullets: [
      "Trasped HG4-218 Formula 1 generic body",
      "2.4 GHz · 3-speed adjustable",
      "USB-C · 20 min drift time",
      "LED headlights · drift wheels included",
    ],
    bodyShape: "F1 generic open-wheel",
    heroImage: "/products/PRC-f1-classic.jpg",
    altImages: [
      "/products/PRC-f1-classic-2.jpg",
      "/products/PRC-f1-classic-3.jpg",
      "/products/PRC-f1-classic-4.jpg",
    ],
    specs: {
      lengthMM: 70,
      drive: "2WD",
      topSpeedKmh: 14,
      batteryMin: 20,
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
    landingCostINR: 550,
    bullets: [
      "Trasped HG4-234 Ferrari-style F1 in white",
      "Detailed aero kit + exposed wheels",
      "2.4 GHz · race 3 cars side-by-side",
      "USB-C · LED headlights · drift wheels swap",
    ],
    bodyShape: "Ferrari-style F1, white livery",
    heroImage: "/products/PRC-f1-ferrari.jpg",
    altImages: [
      "/products/PRC-f1-ferrari-2.jpg",
      "/products/PRC-f1-ferrari-3.jpg",
      "/products/PRC-f1-ferrari-4.jpg",
    ],
    specs: {
      lengthMM: 70,
      drive: "2WD",
      topSpeedKmh: 15,
      batteryMin: 22,
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
    landingCostINR: 550,
    bullets: [
      "Trasped HG4-216 Beetle-style body",
      "Smooth drift on tile + marble",
      "USB-C · 20 min runtime",
      "LED tail-lights · age 6+ friendly",
    ],
    bodyShape: "VW Beetle-style round-roof",
    heroImage: "/products/PRC-beetle.jpg",
    altImages: [
      "/products/PRC-beetle-2.jpg",
      "/products/PRC-beetle-3.jpg",
      "/products/PRC-beetle-4.jpg",
    ],
    specs: {
      lengthMM: 68,
      drive: "2WD",
      topSpeedKmh: 12,
      batteryMin: 20,
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
    landingCostINR: 850,
    bullets: [
      "F1 Leclerc-style body with seated driver figurine",
      "Higher-detail livery + collector finish",
      "Same Trasped 2.4 GHz drift chassis",
      "Premium gift box · display-ready",
    ],
    badge: "PRO",
    bodyShape: "F1 Leclerc-style with driver",
    heroImage: "/products/PRC-f1-driver.jpg",
    altImages: [
      "/products/PRC-f1-driver-2.jpg",
      "/products/PRC-f1-driver-3.jpg",
      "/products/PRC-f1-driver-4.jpg",
    ],
    specs: {
      lengthMM: 72,
      drive: "2WD",
      topSpeedKmh: 15,
      batteryMin: 22,
      chargeMin: 30,
      rangeM: 28,
      minAge: 8,
      led: "Tail + Headlight",
      drift: "Pro drift mode",
    },
  },
];

export const HERO_SKU_ID = "pocket-porsche";

export function getProductById(id: string): Sku | undefined {
  return PRODUCTS.find((p) => p.id === id);
}

export function getHeroSku(): Sku {
  return PRODUCTS.find((p) => p.id === HERO_SKU_ID)!;
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
