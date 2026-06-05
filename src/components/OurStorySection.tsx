"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, MapPin, Truck, Clock } from "lucide-react";
import { THEME } from "@/lib/theme";

const STORY_POINTS = [
  {
    title: "We Pick What Lasts",
    body:
      "We don't drop-ship random toys. Every chassis is tested on tile, marble, and concrete before it earns a spot in our box. Picked by hand in Bangalore by people who actually drive them.",
  },
  {
    title: "From Our Warehouse to Your Door",
    body:
      "Orders dispatch in 24 hours from our Yelahanka warehouse. Shiprocket delivers pan-India — Tier-1 metros in 2 days, Tier-2/3 in 4. Real tracking, real ETAs, no third-party drop-shipping.",
  },
  {
    title: "We're Here After the Sale",
    body:
      "7-day free replacement, spare wheels and batteries in stock, and a real WhatsApp number — not a bot. The kid keeps drifting; you keep your weekend.",
  },
] as const;

export default function OurStorySection() {
  return (
    <section
      id="our-story"
      className="py-8 sm:py-14 bg-white"
      aria-label="Why Bangalore gifts PRC Cars"
    >
      <div className="max-w-6xl mx-auto px-4 grid grid-cols-2 gap-3 sm:gap-10 lg:gap-14 items-center">
        {/* Left: "Ships from Bangalore" info card */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: "-15%" }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="relative"
        >
          <div className="relative aspect-[3/4] sm:aspect-[5/6] rounded-xl sm:rounded-2xl overflow-hidden bg-gradient-to-br from-brand-ink via-neutral-900 to-brand-ink p-3 sm:p-10 flex flex-col justify-between text-white">
            {/* Subtle grid pattern background */}
            <div
              aria-hidden
              className="absolute inset-0 opacity-10"
              style={{
                backgroundImage:
                  "linear-gradient(rgba(255,255,255,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.4) 1px, transparent 1px)",
                backgroundSize: "32px 32px",
              }}
            />

            {/* Top eyebrow */}
            <div className="relative">
              <p className="text-[8px] sm:text-[10px] font-mono uppercase tracking-widest text-brand-red">
                Ships from
              </p>
              <p className="font-display text-xl sm:text-5xl font-bold leading-tight mt-1 sm:mt-2">
                Bangalore
              </p>
              <p className="hidden sm:block text-sm text-white/60 mt-1">
                Yelahanka 1st Stage · Karnataka 560064
              </p>
            </div>

            {/* Middle: dispatch stats */}
            <div className="relative grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-5 my-3 sm:my-0">
              <div>
                <div className="flex items-center gap-1.5 text-brand-red">
                  <Clock size={12} className="sm:hidden" aria-hidden />
                  <Clock size={16} className="hidden sm:block" aria-hidden />
                  <span className="text-[8px] sm:text-[10px] font-mono uppercase tracking-widest">
                    Dispatch
                  </span>
                </div>
                <p className="font-display text-base sm:text-2xl font-bold mt-0.5 sm:mt-1">
                  24 hrs
                </p>
                <p className="hidden sm:block text-xs text-white/60 mt-0.5">
                  Same-day if before 4 PM
                </p>
              </div>
              <div>
                <div className="flex items-center gap-1.5 text-brand-red">
                  <Truck size={12} className="sm:hidden" aria-hidden />
                  <Truck size={16} className="hidden sm:block" aria-hidden />
                  <span className="text-[8px] sm:text-[10px] font-mono uppercase tracking-widest">
                    Pan-India
                  </span>
                </div>
                <p className="font-display text-base sm:text-2xl font-bold mt-0.5 sm:mt-1">
                  2–4 days
                </p>
                <p className="hidden sm:block text-xs text-white/60 mt-0.5">
                  Shiprocket · COD ready
                </p>
              </div>
            </div>

            {/* Bottom: store coming soon banner */}
            <div className="relative bg-white/5 border border-white/10 rounded-md sm:rounded-xl p-2 sm:p-4 backdrop-blur-sm">
              <div className="flex items-center gap-1.5">
                <MapPin size={12} className="text-brand-red sm:hidden" aria-hidden />
                <MapPin size={16} className="text-brand-red hidden sm:block" aria-hidden />
                <span className="text-[8px] sm:text-[10px] font-mono uppercase tracking-widest text-brand-red font-semibold">
                  Store
                </span>
                <span className="ml-auto text-[8px] sm:text-[10px] font-mono uppercase tracking-widest text-white/40">
                  Coming soon
                </span>
              </div>
              <p className="hidden sm:block text-sm text-white/80 mt-2 leading-snug">
                Bangalore drift studio + showroom — opening this year. WhatsApp
                us to RSVP for the launch.
              </p>
            </div>
          </div>

        </motion.div>

        {/* Right: 3 pillars + CTA */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: "-15%" }}
          transition={{ duration: 0.5, ease: "easeOut", delay: 0.1 }}
        >
          <p className="text-[10px] sm:text-xs font-mono font-bold uppercase tracking-widest text-brand-red">
            Our Story
          </p>
          <h2 className="font-display text-lg sm:text-4xl lg:text-5xl font-bold text-brand-ink mt-1 sm:mt-2 leading-tight text-balance">
            Why Bangalore <br className="sm:hidden" />gifts{" "}
            <br className="hidden sm:block" />
            <span className="text-brand-red">{THEME.brandName}</span>
          </h2>
          <p className="hidden sm:block text-base text-brand-ink-soft mt-4 leading-relaxed">
            Designed, packed, and shipped from{" "}
            <strong className="text-brand-ink font-semibold">
              Yelahanka, Bengaluru
            </strong>
            . Real people, real warehouse, real WhatsApp number — not a
            drop-shipper.
          </p>

          <ul className="mt-3 sm:mt-7 space-y-2.5 sm:space-y-5">
            {STORY_POINTS.map((p, i) => (
              <li key={p.title} className="flex items-start gap-2 sm:gap-4">
                <span className="shrink-0 w-6 h-6 sm:w-9 sm:h-9 rounded-full border-2 border-brand-line text-brand-ink-soft font-mono font-bold text-[10px] sm:text-sm flex items-center justify-center">
                  0{i + 1}
                </span>
                <div className="pt-0 sm:pt-0.5">
                  <h3 className="font-display text-xs sm:text-lg font-bold text-brand-ink leading-tight">
                    {p.title}
                  </h3>
                  <p className="hidden sm:block text-sm text-brand-ink-soft leading-relaxed mt-1">
                    {p.body}
                  </p>
                </div>
              </li>
            ))}
          </ul>

          <Link
            href="/#sku"
            className="mt-3 sm:mt-7 inline-flex items-center gap-1 sm:gap-2 text-[11px] sm:text-sm font-semibold text-brand-red border-b-2 border-brand-red pb-0.5 sm:pb-1 hover:gap-3 transition-all"
          >
            <span className="sm:hidden">Pick yours →</span>
            <span className="hidden sm:inline">Pick your drift — from ₹999</span>
            <ArrowRight size={14} className="hidden sm:block" />
          </Link>

          {/* Named founder signal — replaces an abstract "real people" claim
              with a real human and a real first name. The cheapest, highest-
              converting trust artefact for an Instagram-sourced buyer. */}
          <figure className="hidden sm:flex mt-7 items-start gap-3 border-t border-brand-line pt-5">
            <span
              aria-hidden
              className="shrink-0 w-11 h-11 rounded-full bg-brand-ink text-white font-display font-bold text-base flex items-center justify-center"
            >
              S
            </span>
            <blockquote className="text-sm text-brand-ink-soft leading-relaxed">
              &ldquo;Every car ships from my warehouse in Yelahanka. If yours
              arrives broken or stops working in the first 7 days, message me
              on WhatsApp — I&rsquo;ll replace it.&rdquo;
              <footer className="mt-2 text-xs font-mono uppercase tracking-widest text-brand-ink not-italic">
                — Syed,{" "}
                <span className="text-brand-ink-soft">
                  Founder · PRC Cars · Bangalore
                </span>
              </footer>
            </blockquote>
          </figure>
        </motion.div>
      </div>
    </section>
  );
}
