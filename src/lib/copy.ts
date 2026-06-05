export type HeroVariant =
  | "default"
  | "gift"
  | "couple"
  | "parent"
  | "carride"
  | "enthusiast";

export const HERO_VARIANTS: Record<
  HeroVariant,
  { h1: string; sub: string; ctaLabel: string }
> = {
  default: {
    h1: "Drift. Race. Pocket.",
    sub: "Die-cast 1:64 drift cars from ₹999. Same-day from Bangalore · COD pan-India.",
    ctaLabel: "Shop now — from ₹999",
  },
  gift: {
    h1: "The Gift Every Car Guy Melts Over",
    sub: "Die-cast Pocket drift cars from ₹999 — gift-ready, dispatched in 24 hrs.",
    ctaLabel: "🎁 Pick a Gift — from ₹999",
  },
  couple: {
    h1: "Bata bhi nahi paayegi, smile rok bhi nahi paayega",
    sub: "The mini drift car every car-guy wants. From ₹999.",
    ctaLabel: "🎁 Surprise Him — from ₹999",
  },
  parent: {
    h1: "Swap His Screen Time for Real Play",
    sub: "USB-C · 30-min runtime · drop-tested 1.2m · Age 8+. From ₹999.",
    ctaLabel: "Order for Your Kid — from ₹999",
  },
  carride: {
    h1: "The Toy That Survives the Back Seat",
    sub: "Hand over the remote. Get the silence. From ₹999.",
    ctaLabel: "Get Yours — from ₹999",
  },
  enthusiast: {
    h1: "1:64 drift. Alloy body. From ₹999.",
    sub: "Hobby-grade build, pocket-grade price. Pan-India COD · 24-hr dispatch.",
    ctaLabel: "Cart it. Drift it tonight. →",
  },
};

export type Announcement = {
  text: string;
  /** Optional CTA href. If present, the announcement renders as a link with an arrow. */
  href?: string;
  /** Optional verb tag rendered as a colored pill before the text */
  tag?: string;
  /** Optional emoji prefix */
  emoji?: string;
};

export const ANNOUNCEMENTS: Announcement[] = [
  {
    text: "Pay online → ₹100 bonus + same-day dispatch",
  },
  {
    text: "Ships in 24 hrs from Bangalore · Free shipping over ₹1,099",
  },
  {
    emoji: "📦",
    text: "Pan-India COD · 7-day replacement · WhatsApp support",
  },
];

export const USPS = [
  { iconKey: "usbc", title: "USB-C charging", sub: "30-min full charge" },
  { iconKey: "drop", title: "Drop-tested 1.5m", sub: "Replaceable shell ₹99" },
  { iconKey: "shield", title: "7-day replacement", sub: "Age 8+ recommended" },
  { iconKey: "india", title: "Assembled in India", sub: "GST-paid" },
] as const;

export const FAQS: { q: string; a: string; defaultOpen?: boolean }[] = [
  {
    q: "Is COD available?",
    a: "Yes — pan-India COD with a ₹49 fee on orders below ₹999. Pay online instead and save ₹100. UPI, cards, net banking, and BNPL (Simpl, LazyPay) all accepted.",
    defaultOpen: true,
  },
  {
    q: "How long does the battery last?",
    a: "Storm Mini (1:64): 25 min runtime · USB-C full charge in 25 min. Storm (1:43): 35 min runtime · charge in 30 min. Storm Pro (1:24): 45 min runtime · charge in 40 min.",
  },
  {
    q: "What age is this for?",
    a: "Storm Mini — 6+. Storm — 8+. Storm Pro — 10+. Adults love all three.",
  },
  {
    q: "What if it breaks?",
    a: "7-Day Free Replacement on damage or defect — no questions asked. WhatsApp us a photo, we'll dispatch a new one the same day. Spare parts (shell ₹99, battery ₹199) shipped from Bangalore for normal wear-and-tear.",
  },
  {
    q: "Where do you ship?",
    a: "Pan-India. Bangalore, Mumbai, Delhi-NCR metros in 2–3 days. Tier-2 / Tier-3 cities in 4–7 days. Dispatch from Bangalore within 24 hours of order confirmation.",
  },
  {
    q: "Can I gift-wrap it?",
    a: "Yes — every order ships in a premium gift box. Add a handwritten note free at checkout. Dispatch SMS goes to the buyer (you), not the recipient.",
  },
  {
    q: "Does it work on carpet / tiles?",
    a: "Both work. Smooth floors (tile, marble, wood) give the best drift. On carpet you lose the slide but gain grip — still fun.",
  },
  {
    q: "What's in the box?",
    a: "Car (assembled), 2.4 GHz remote, rechargeable battery, USB-C cable, spare drift wheel set, premium gift box, quick-start guide.",
  },
  {
    q: "Do you sell spare parts?",
    a: "Yes — body shell ₹99, battery ₹199, drift wheels ₹99 (set), remote ₹299. Shipped from Bangalore in 3 days.",
  },
  {
    q: "Bulk / wholesale orders for my shop?",
    a: "Visit /wholesale to register (GSTIN required). MOQ from 12 pieces. Trade pricing 35–52% off MRP depending on quantity.",
  },
];

export const REVIEWS_SEED = [
  {
    rating: 5,
    text: "Bought the Storm for my husband's birthday. He literally screamed. Now he drifts it every day in the living room. The LED lights are insane.",
    name: "Priya M.",
    city: "Bangalore",
    sku: "1:43 Storm",
    date: "23 March 2026",
  },
  {
    rating: 5,
    text: "My 8-year-old's screen time has dropped by half. He's outside in the parking lot drifting this every evening. Worth every rupee.",
    name: "Rohan K.",
    city: "Pune",
    sku: "1:64 Storm Mini",
    date: "17 April 2026",
  },
  {
    rating: 5,
    text: "I'm 32, I bought it for myself. Showed it at the office, three colleagues ordered. The gyro on the 1:24 is no joke.",
    name: "Karthik R.",
    city: "Bangalore",
    sku: "1:24 Storm Pro",
    date: "2 May 2026",
  },
  {
    rating: 5,
    text: "Gift box was actually premium. Delivered in 3 days to Indore. Husband still hasn't put it down.",
    name: "Anu S.",
    city: "Indore",
    sku: "1:43 Storm",
    date: "11 April 2026",
  },
];
