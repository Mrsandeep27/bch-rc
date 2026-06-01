/**
 * Theme config — change values here to clone this template for a new store.
 * Every store-specific string, color, and product reference flows from this file.
 *
 * Active store: PRC Cars (pocketrccars.com)
 * Locked: 2026-06-01
 */

export const THEME = {
  // Brand identity
  brandName: "PRC Cars",
  fullName: "Pocket RC Cars",
  tagline: "Drift. Race. Pocket.",
  subTagline: "F1 in your pocket — ₹1,299. Pan-India COD.",
  domain: "pocketrccars.com",
  scaleFocus: "1:64",
  city: "Bangalore",

  // Logo paths (in public/logo/) — Photoroom-cleaned, real alpha, tight-cropped
  logoMain: "/logo/prc-logo-white-tight.png", // white wordmark + car, transparent — use on dark
  logoDark: "/logo/prc-logo-black-tight.png", // black wordmark + car, transparent — use on light
  logoBadge: "/logo/prc-red-accent.png",       // round black badge + red car — social profile pic
  favicon: "/logo/prc-favicon-512.png",

  // Contact (placeholders until Syed provides)
  whatsappNumber: "919999999999",
  email: "hello@pocketrccars.com",
  phoneDisplay: "+91 99999 99999",
  instagramHandle: "pocketrccars",
  youtubeHandle: "pocketrccars",

  // Hero
  heroH1: "Drift. Race. Pocket.",
  heroSub: "F1 in your pocket — ₹1,299. LED · drift wheels · COD pan-India.",
  heroCtaLabel: "🛒 Shop the Pocket F1 — ₹1,299",
  heroImageSrc: "/hero/hero-v2-frontal-right.png",
  heroVideoSrc: "/hero/drift-loop.mp4",
  heroPosterSrc: "/hero/hero-v2-frontal-right.png",

  // Color palette — Palette A · Racing Red (locked 2026-06-01)
  colors: {
    primary: "#E11D2A",        // brand red
    primaryHover: "#C4151F",
    primarySoft: "#FEF2F3",
    ink: "#0A0A0A",            // matte black
    inkSoft: "#525252",
    cream: "#FAF8F5",          // off-white background
    line: "#E5E5E5",
    accent: "#FACC15",         // finish-line yellow (for badges)
    success: "#16A34A",
    whatsapp: "#25D366",
  },

  // Offers
  prepaidDiscountINR: 100,
  freeShippingMinINR: 1099,
  codFeeINR: 49,
  codFeeAppliesBelowINR: 999,
  bundle2PriceINR: 2299,       // Buy 2 = ₹2,299 (save ₹299)
  bundle2SaveINR: 299,
  bundle3PriceINR: 3199,       // Buy 3 = ₹3,199 (save ₹698)
  bundle3SaveINR: 698,
  ledSmokeUpgradeINR: 200,
  driverFigurineUpgradeINR: 600,  // base ₹1,299 → Pro ₹1,899

  // Trust signals
  ordersShipped: 12000,
  rating: 4.7,
  reviewCount: 2341,
  instagramFollowers: 60000,

  // Featured-in (logos / handles)
  featuredIn: ["@daddydrones", "@youcliq", "@thepeppystore"],

  // Final CTA
  finalCtaH2: "Order now — dispatched in 24 hrs from Bangalore.",
} as const;

export function waLink(message?: string): string {
  const base = `https://wa.me/${THEME.whatsappNumber}`;
  if (!message) return base;
  return `${base}?text=${encodeURIComponent(message)}`;
}
