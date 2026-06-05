export type HeroVariant =
  | "default"
  | "gift"
  | "couple"
  | "parent"
  | "carride"
  | "enthusiast";

export const HERO_VARIANTS: Record<
  HeroVariant,
  {
    h1: string;
    /** Optional emphasised lead word styled in brand-red. Lets the H1 read
     *  as one line while the keyword ("gift") visually anchors the hook. */
    h1Accent?: string;
    sub: string;
    ctaLabel: string;
    /** Three-line trust strip surfaced directly under the CTA. Ordered
     *  blocker-first: COD pre-pay-fear reliever first, then replacement,
     *  then real human support. Replaces the "Free shipping / 24-hr
     *  dispatch / 7-day replacement" generic bottom strip. */
    underCta: [string, string, string];
  }
> = {
  // Default — built for the IG-gifter the traffic model targets. The reels
  // arrive in gift mode; the page now opens in gift mode too. Five-second
  // test: product noun ("RC drift car"), buyer (gift-giver), feeling
  // ("car-crazy guy"), price (₹999/₹1,099), payment (COD), dispatch
  // (24-hr Bangalore). All present.
  default: {
    h1: "The gift every car-crazy guy actually keeps using.",
    h1Accent: "gift",
    sub:
      "A real die-cast RC drift car that fits in his palm — LED, drift wheels in the box, " +
      "actually drifts on tile. ₹999 online or ₹1,099 COD, gift-ready box, ships in " +
      "24 hrs from Bangalore.",
    ctaLabel: "🛒 Order his gift — from ₹999, COD",
    underCta: [
      "Pay on delivery — nothing now",
      "7-day replacement",
      "Real WhatsApp support",
    ],
  },
  // Explicit gift UTM — same shape since default is now gifting-first.
  // Kept distinct so we can fork copy later without touching default.
  gift: {
    h1: "The gift every car-crazy guy actually keeps using.",
    h1Accent: "gift",
    sub:
      "Die-cast Pocket RC drift cars from ₹999 — gift-ready box, dispatched " +
      "in 24 hrs from Bangalore.",
    ctaLabel: "🎁 Order his gift — from ₹999, COD",
    underCta: [
      "Pay on delivery — nothing now",
      "7-day replacement",
      "Real WhatsApp support",
    ],
  },
  // Hinglish IG-DM landing — message-match for the "Unexpected Gift 🎁"
  // reels (Copy Crimes #8 fix). Same gifting frame, buyer's voice.
  couple: {
    h1: "₹999 mein asli RC drift car — uska face dekhna jab ye drift karega.",
    sub:
      "Real die-cast drift car, palm-size, LED + drift wheels in the box. " +
      "Gift-ready packaging. COD pan-India. Aaj order karo, Bangalore se " +
      "24 ghante mein niklega.",
    ctaLabel: "🎁 Surprise him — from ₹999, COD",
    underCta: [
      "COD pan-India · nothing now",
      "7-day replacement guarantee",
      "WhatsApp support — real human",
    ],
  },
  // Parent UTM — gift for any car-lover 8 to 38. Doesn't infantilise the
  // recipient (was "Your Kid"). Joy frame leads, spec demoted.
  parent: {
    h1: "The gift the car-lover in your life actually keeps using.",
    h1Accent: "gift",
    sub:
      "Real die-cast RC drift car for any car-lover 8 to 38 — drop-tested " +
      "1.2 m, USB-C, drift wheels included. ₹999 online or ₹1,099 COD, " +
      "gift-ready box, ships in 24 hrs from Bangalore.",
    ctaLabel: "🛒 Order his gift — from ₹999, COD",
    underCta: [
      "Pay on delivery — nothing now",
      "7-day replacement",
      "Drop-tested for indoor floors",
    ],
  },
  // Road-trip flavour, same gifting frame.
  carride: {
    h1: "Hand him this. Get the silence.",
    sub:
      "Real die-cast RC drift car that drifts on tile + marble — the back-seat " +
      "gift that lasts past the airport. ₹999 online or ₹1,099 COD, ships " +
      "24 hrs from Bangalore.",
    ctaLabel: "🛒 Order his gift — from ₹999, COD",
    underCta: [
      "Pay on delivery — nothing now",
      "7-day replacement",
      "Real WhatsApp support",
    ],
  },
  // Most-Aware visitor (drift-clip UTM) — already knows what they want.
  // Don't re-pitch price (Psych p03/p07). Speak in the enthusiast register.
  enthusiast: {
    h1: "Your drift car. In your palm. Tonight.",
    sub:
      "1:64 die-cast, 2.4 GHz, drift + grip wheels in the box, USB-C, real " +
      "LED. Ships from Bangalore in 24 hrs. Pan-India COD.",
    ctaLabel: "Cart it. Drift it tonight. →",
    underCta: [
      "Drop-tested for indoor floors",
      "7-day replacement",
      "Real WhatsApp support",
    ],
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

// P12 — joy / operational reassurance wins position #1 in the marquee.
// Money cue (the ₹100 bonus) moves into position #3. The reviewer's point:
// whatever cue occupies the privileged opening moment becomes the focal
// criterion. Leading with "Pay online → ₹100 bonus" framed the page as
// "is it worth it?" before desire could build. Now the marquee opens on
// "Ships today from Bangalore" (operational reassurance), then the COD
// pan-India reliever, then the bonus.
export const ANNOUNCEMENTS: Announcement[] = [
  {
    text: "Ships today from Bangalore · order before 4 PM",
  },
  {
    emoji: "📦",
    text: "Pan-India COD · 7-day replacement · real WhatsApp support",
  },
  {
    text: "Pay online → ₹100 bonus + same-day dispatch",
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
    a: "Pan-India. Most big cities (Bangalore, Mumbai, Delhi-NCR, Chennai, Hyderabad, Pune) get it in 2-3 days. Smaller cities and towns 4-7 days. Real Shiprocket tracking on WhatsApp — we ship it ourselves from Bangalore, no middleman.",
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
