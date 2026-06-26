/**
 * 1:16 storefront config — the "Big" series.
 *
 * Self-contained on purpose: this store lives at /16 with its own palette
 * (scoped via `.store-16` in globals.css) and its own catalogue, so it shares
 * NONE of the live 1:64 THEME/PRODUCTS. Edit copy + catalogue here.
 *
 * Palette (per owner brief 2026-06-25):
 *   accent / headings  #3A5069 (slate-blue — replaces the 1:64 racing red)
 *   page background     #F5F5F5
 *   font style          TBD (decided later)
 *
 * Images: placeholders for now — real photography is handled separately.
 */

export type Store16Colour = {
  name: string;
  /** swatch hex for the colour dot */
  swatch: string;
  /** second swatch for two-tone finishes (optional) */
  swatch2?: string;
  /** placeholder image slot id — real <img> wired in later */
  imageKey: string;
};

export type Store16Model = {
  id: string;
  name: string;
  priceINR: number;
  /** Gen-Z one-liner */
  blurb: string;
  /** spec bullets shown on the card */
  specs: string[];
  colours: Store16Colour[];
};

export const STORE16 = {
  brandName: "PRC Cars",
  parentBrand: "Pocket RC Cars",
  scaleFocus: "1:16",
  domain: "pocketrccars.com/16",

  // Voice mirrors the 1:64 store: benefit-first, concrete (price, COD, ships
  // from Bangalore), a little edge. Scale is stated ONCE, low-key, in the
  // eyebrow — and again only in the size FAQ — never plastered across
  // headlines, CTAs, badges or the marquee.
  eyebrow: "Sold from Bangalore · 1:16 scale",
  heroH1: "Send it sideways.",
  heroH1Accent: "sideways.",
  heroSub:
    "Bigger build, real proportional steering, 4WD and rubber tyres. From ₹2,899 online — COD pan-India, ships from Bangalore.",
  heroCtaLabel: "Shop the lineup",

  trust: ["COD pan-India", "7-day replacement", "Ships from Bangalore"],

  specMarquee: [
    "FULL PROPORTIONAL STEER",
    "4WD",
    "2.4 GHz",
    "LED LIGHTS",
    "RUBBER DRIFT TYRES",
    "USB-C RECHARGEABLE",
  ],

  lineupEyebrow: "The lineup",
  lineupH2: "Pick your weapon.",
  lineupSub: "Two builds, six finishes. All of them send it.",

  howEyebrow: "Dead simple",
  howH2: "Charge it. Send it. Repeat.",
  howSteps: [
    { t: "Charge it", d: "USB-C in — the battery's built in, tops up off any phone brick." },
    { t: "Send it", d: "Squeeze the throttle, real proportional steer — feather it into the slide." },
    { t: "Run it back", d: "Snap on the drift tyres, find a smooth floor, go again." },
  ],

  bundleEyebrow: "Squad up",
  bundleH2: "Grab two, save more.",
  bundleSub: "Bundle any two cars and the price drops. More cars, more chaos — message us for the combo rate.",

  faqEyebrow: "FAQ",
  faqH2: "Quick answers.",
  faqs: [
    { q: "How big are these?", a: "Proper display-and-drive size — much bigger than the pocket cars, with real rubber tyres and a full-size pistol-grip remote. These run 1:16 scale." },
    { q: "Is it hard to drive?", a: "Not at all. Full proportional steering means you control exactly how far it turns — feather it for clean slides. Most people have it figured out in a few minutes." },
    { q: "Is COD available?", a: "Yes — Cash on Delivery pan-India, same as the rest of PRC. Pay online and you save a bit extra." },
    { q: "What if it turns up damaged?", a: "7-day replacement, no drama. WhatsApp us a quick unboxing clip and a fresh one ships out." },
  ],

  finalH2: "Stop scrolling. Start sliding.",
  finalSub: "Bigger drift, built to send it. From ₹2,899 — COD pan-India.",
  finalCta: "Shop the lineup",

  // Contact (shared PRC line)
  whatsappNumber: "916362346498",
  instagramHandle: "164prccars",
} as const;

export const STORE16_MODELS: Store16Model[] = [
  {
    id: "drift",
    name: "Drift",
    priceINR: 2999,
    blurb: "The everyday slider. 4WD, rubber tyres, built to abuse.",
    specs: ["4WD · proportional steer", "Rubber drift tyres", "USB-C · LED lights"],
    colours: [
      { name: "Red", swatch: "#C62828", imageKey: "drift-red" },
      { name: "Neon Green", swatch: "#B6FF00", imageKey: "drift-neon-green" },
      { name: "Black", swatch: "#1A1A1A", imageKey: "drift-black" },
      { name: "Carbon Fiber", swatch: "#33373B", imageKey: "drift-carbon" },
    ],
  },
  {
    id: "dares",
    name: "Dares",
    priceINR: 3599,
    blurb: "The flagship. Race livery, sharper body, more presence.",
    specs: ["4WD · proportional steer", "Race-livery body", "USB-C · LED lights"],
    colours: [
      { name: "White / Blue", swatch: "#2E6FB5", swatch2: "#E8EDF2", imageKey: "dares-white-blue" },
      { name: "Green / Grey", swatch: "#5C7A5E", swatch2: "#7E8890", imageKey: "dares-green-grey" },
    ],
  },
];

/* ── Full catalogue: 6 named, buyable products (PDP-ready) ──────────────────
   Each Drift/Dares colourway is its own product with a distinct name, a Gen-Z
   one-liner and a PDP description. Specs are the real numbers scraped from the
   competitor listings for this exact 1:16 class of car — minus any BIS / origin
   claims we can't verify. Dares is the same hardware in a sharper race shell. */

export type Store16Product = {
  slug: string;
  series: "Drift" | "Dares";
  edition: string; // e.g. "Inferno"
  name: string; // display name, e.g. "Drift Inferno"
  colorway: string; // e.g. "Red"
  priceINR: number;
  swatch: string;
  swatch2?: string;
  imageKey: string;
  /** Card/thumbnail image. Undefined → neutral placeholder (photo not shot yet). */
  heroImage?: string;
  /** PDP gallery: [hero, ...angles]. Undefined → placeholder. */
  images?: string[];
  tagline: string; // one-liner for the card
  description: string; // PDP paragraph
  specs: string[];
  inBox: string[];
};

const DRIFT_SPECS = [
  "1:16 scale · roughly 28 cm long — a proper desk-to-floor size",
  "4WD drivetrain · up to ~25 km/h",
  "2.4 GHz full-proportional remote — steering, throttle, brake + speed trim",
  "ESP electronic stability for clean, controllable drifts",
  "Rubber drift tyres + a spare set included",
  "Full LED lights · USB-C rechargeable battery pack",
];

const DARES_SPECS = [
  "1:16 scale · sharper, wider race-livery shell",
  "4WD drivetrain · up to ~25 km/h",
  "2.4 GHz full-proportional remote — steering, throttle, brake + speed trim",
  "ESP electronic stability for clean, controllable drifts",
  "Rubber drift tyres + a spare set included",
  "Full LED lights · USB-C rechargeable battery pack",
];

const IN_BOX = [
  "1 × RC car (ready-to-run)",
  "1 × 2.4 GHz remote",
  "1 × rechargeable battery + USB-C cable",
  "1 × spare set of drift tyres",
  "Drift cones + mini screwdriver",
];

export const STORE16_PRODUCTS: Store16Product[] = [
  {
    slug: "drift-inferno",
    series: "Drift",
    edition: "Inferno",
    name: "Drift Inferno",
    colorway: "Red",
    priceINR: 2999,
    swatch: "#C62828",
    imageKey: "drift-red",
    heroImage: "/store16-images/drift-inferno/1-hero.webp",
    images: [
      "/store16-images/drift-inferno/1-hero.webp",
      "/store16-images/drift-inferno/2-side.webp",
      "/store16-images/drift-inferno/3-detail.webp",
      "/store16-images/drift-inferno/4-lifestyle.webp",
    ],
    tagline: "Pillar-box red you'll spot mid-slide from across the room.",
    description:
      "The everyday slider in loud, look-at-me red. 4WD grip and rubber drift tyres mean it actually holds a line, and the 2.4 GHz proportional remote lets you feather every corner. Charge it over USB-C, hit a smooth floor, send it.",
    specs: DRIFT_SPECS,
    inBox: IN_BOX,
  },
  {
    slug: "drift-toxic",
    series: "Drift",
    edition: "Toxic",
    name: "Drift Toxic",
    colorway: "Neon Green",
    priceINR: 2999,
    swatch: "#B6FF00",
    imageKey: "drift-neon-green",
    heroImage: "/store16-images/drift-toxic/1-hero.webp",
    images: [
      "/store16-images/drift-toxic/1-hero.webp",
      "/store16-images/drift-toxic/2-side.webp",
      "/store16-images/drift-toxic/3-detail.webp",
      "/store16-images/drift-toxic/4-lifestyle.webp",
    ],
    tagline: "Highlighter-green and loud about it — impossible to lose.",
    description:
      "Same everyday slider, dialled up in toxic neon green. 4WD, full-proportional steering and ESP stability keep the slides clean while the LED lights and rubber tyres do the showing off. USB-C charge, ready to run out of the box.",
    specs: DRIFT_SPECS,
    inBox: IN_BOX,
  },
  {
    slug: "drift-phantom",
    series: "Drift",
    edition: "Phantom",
    name: "Drift Phantom",
    colorway: "Black",
    priceINR: 2999,
    swatch: "#1A1A1A",
    imageKey: "drift-black",
    heroImage: "/store16-images/drift-phantom/1-hero.webp",
    images: [
      "/store16-images/drift-phantom/1-hero.webp",
      "/store16-images/drift-phantom/2-side.webp",
      "/store16-images/drift-phantom/3-detail.webp",
      "/store16-images/drift-phantom/4-lifestyle.webp",
    ],
    tagline: "Murdered-out black. Stealth in, sideways out.",
    description:
      "Blacked-out everyday slider for people who let the driving talk. 4WD drivetrain, rubber drift tyres and a 2.4 GHz proportional remote with speed trim — beginner-smooth or full-send, your call. USB-C rechargeable, ready to run.",
    specs: DRIFT_SPECS,
    inBox: IN_BOX,
  },
  {
    slug: "drift-carbon",
    series: "Drift",
    edition: "Carbon",
    name: "Drift Carbon",
    colorway: "Carbon Fiber",
    priceINR: 2999,
    swatch: "#33373B",
    imageKey: "drift-carbon",
    tagline: "Carbon-weave shell with a race-car finish — the quiet flex.",
    description:
      "The everyday slider in a carbon-fibre-look shell that reads way pricier than it is. Same 4WD grip, ESP-assisted drifts, full-proportional control and LED lighting. Charge over USB-C and it's ready straight from the box.",
    specs: DRIFT_SPECS,
    inBox: IN_BOX,
  },
  {
    slug: "dares-azure",
    series: "Dares",
    edition: "Azure",
    name: "Dares Azure",
    colorway: "White / Blue",
    priceINR: 3599,
    swatch: "#2E6FB5",
    swatch2: "#E8EDF2",
    imageKey: "dares-white-blue",
    heroImage: "/store16-images/dares-azure/1-hero.webp",
    images: [
      "/store16-images/dares-azure/1-hero.webp",
      "/store16-images/dares-azure/2-side.webp",
      "/store16-images/dares-azure/3-detail.webp",
      "/store16-images/dares-azure/4-lifestyle.webp",
    ],
    tagline: "Full race livery in white and blue — the flagship, dressed to win.",
    description:
      "The flagship Dares wears a proper white-and-blue race livery on a sharper, wider body with more presence on the floor. Underneath it's the same proven 4WD drift platform — proportional 2.4 GHz control, ESP stability, rubber tyres, LED lights and USB-C charging.",
    specs: DARES_SPECS,
    inBox: IN_BOX,
  },
  {
    slug: "dares-recon",
    series: "Dares",
    edition: "Recon",
    name: "Dares Recon",
    colorway: "Green / Grey",
    priceINR: 3599,
    swatch: "#5C7A5E",
    swatch2: "#7E8890",
    imageKey: "dares-green-grey",
    heroImage: "/store16-images/dares-recon/1-hero.webp",
    images: [
      "/store16-images/dares-recon/1-hero.webp",
      "/store16-images/dares-recon/2-side.webp",
      "/store16-images/dares-recon/3-detail.webp",
      "/store16-images/dares-recon/4-lifestyle.webp",
    ],
    tagline: "Military green-grey, tactical and mean — the flagship gone covert.",
    description:
      "The flagship Dares in a stealthy green-and-grey colourway with the same wider race shell. Full 4WD drift hardware — proportional steering, ESP stability, rubber drift tyres, LED lights and a USB-C rechargeable pack. Ready to run on any smooth floor.",
    specs: DARES_SPECS,
    inBox: IN_BOX,
  },
];

export function getStore16Product(slug: string): Store16Product | undefined {
  return STORE16_PRODUCTS.find((p) => p.slug === slug);
}

export function store16WaLink(message?: string): string {
  const base = `https://wa.me/${STORE16.whatsappNumber}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}

export function formatINR16(n: number): string {
  return `₹${n.toLocaleString("en-IN")}`;
}
