"use client";

import Image from "next/image";
import { motion } from "framer-motion";

type Feature = {
  eyebrow: string;
  title: string;
  body: string;
  /** Background image (Gemini-generated, portrait 4:5) */
  bgImage: string;
  /** True when the headline is already baked into the image — body-only in card */
  bakedTitle?: boolean;
};

const FEATURES: Feature[] = [
  {
    eyebrow: "01 · Drift",
    title: "Slides on any smooth floor.",
    body: "Tile, marble, hardwood. Drift wheels included.",
    bgImage: "/features/drift.jpg",
    bakedTitle: true,
  },
  {
    eyebrow: "02 · Pocket",
    title: "Fits in your palm.",
    body: "1:64 scale. ~7cm long. Same size as Hot Wheels.",
    bgImage: "/features/pocket.jpg",
  },
  {
    eyebrow: "03 · Charge",
    title: "USB-C, full in 30 minutes.",
    body: "One cable charges everything. 20 min drift per top-up.",
    bgImage: "/features/usbc.jpg",
  },
  {
    eyebrow: "04 · Race",
    title: "3 friends. Zero interference.",
    body: "2.4 GHz independent channels. Race 3 cars side-by-side.",
    bgImage: "/features/race.jpg",
  },
];

function Tile({ feat, i }: { feat: Feature; i: number }) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.5, delay: i * 0.08, ease: "easeOut" }}
      className="relative rounded-3xl overflow-hidden aspect-[4/5] flex flex-col text-white isolate group bg-brand-ink"
    >
      {/* Background image — full-bleed. Hover-scale is gated to devices that
          actually have hover (desktop). On mobile, touch fires the hover
          state mid-swipe and the 700ms scale transform feels like the image
          is shaking. `lg:` + Tailwind hover variant keeps the desktop polish
          without the mobile jitter. */}
      <Image
        src={feat.bgImage}
        alt=""
        fill
        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
        className="object-cover transition-transform duration-700 lg:group-hover:scale-105"
        priority={i < 2}
      />

      {/* Subtle top vignette so eyebrow reads */}
      <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/55 to-transparent pointer-events-none" />

      {/* Eyebrow — top-left */}
      <div className="relative z-10 p-5 sm:p-6">
        <span className="font-mono text-[10px] sm:text-xs uppercase tracking-[0.25em] text-white/95 drop-shadow">
          {feat.eyebrow}
        </span>
      </div>

      <div className="flex-1" />

      {/* Compact glass card pinned bottom — minimal footprint, image stays the hero */}
      <div className="relative z-10 mx-3 mb-3 sm:mx-4 sm:mb-4 px-3.5 py-2.5 sm:px-4 sm:py-3 rounded-xl bg-black/60 backdrop-blur-md border border-white/10 shadow-xl">
        {!feat.bakedTitle && (
          <h3 className="font-display text-base sm:text-lg font-bold leading-tight text-balance">
            {feat.title}
          </h3>
        )}
        <p
          className={
            "text-white/85 text-[11px] sm:text-xs leading-snug " +
            (!feat.bakedTitle ? "mt-1" : "")
          }
        >
          {feat.body}
        </p>
      </div>
    </motion.article>
  );
}

export default function FeatureCarousel() {
  return (
    <section className="py-8 sm:py-14 bg-white">
      <div className="max-w-7xl mx-auto px-4">
        <div className="text-center max-w-2xl mx-auto">
          <span className="font-mono text-xs uppercase tracking-widest text-brand-red">
            What it does
          </span>
          <h2 className="font-display text-3xl sm:text-5xl font-bold text-brand-ink mt-2 text-balance">
            Pocket-sized. Track-ready.
          </h2>
          <p className="text-brand-ink-soft text-base sm:text-lg mt-3">
            Every car ships with what you actually need. No paywalled mode, no extra battery to buy.
          </p>
        </div>

        {/* Mobile: one full card per swipe (snap-x snap-mandatory + 92vw
            cards). Eliminates the earlier "stuck-between-cards" feel from
            the old 78%-wide peek layout — now you swipe and a single card
            lands centered, with only ~4% of the next card visible as an
            affordance hint. Desktop (sm+): standard 2/4 col static grid. */}
        <div className="mt-6 sm:mt-10 -mx-4 sm:mx-0 overflow-x-auto sm:overflow-visible snap-x snap-mandatory sm:snap-none no-scrollbar touch-pan-x overscroll-x-contain">
          <div className="flex sm:grid sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 px-4 sm:px-0 pb-2 sm:pb-0">
            {FEATURES.map((f, i) => (
              <div
                key={f.title}
                className="snap-center shrink-0 w-[92%] sm:w-auto"
              >
                <Tile feat={f} i={i} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
