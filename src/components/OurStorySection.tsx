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
      className="py-16 sm:py-24 bg-white"
      aria-label="Why Bangalore gifts PRC Cars"
    >
      <div className="max-w-6xl mx-auto px-4 grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-14 items-center">
        {/* Left: "Ships from Bangalore" info card */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: "-15%" }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="relative"
        >
          <div className="relative aspect-[5/6] rounded-2xl overflow-hidden bg-gradient-to-br from-brand-ink via-neutral-900 to-brand-ink p-8 sm:p-10 flex flex-col justify-between text-white">
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
              <p className="text-[10px] font-mono uppercase tracking-widest text-brand-red">
                Ships from
              </p>
              <p className="font-display text-4xl sm:text-5xl font-bold leading-tight mt-2">
                Bangalore
              </p>
              <p className="text-sm text-white/60 mt-1">
                Yelahanka 1st Stage · Karnataka 560064
              </p>
            </div>

            {/* Middle: dispatch stats */}
            <div className="relative grid grid-cols-2 gap-5 my-6 sm:my-0">
              <div>
                <div className="flex items-center gap-2 text-brand-red">
                  <Clock size={16} aria-hidden />
                  <span className="text-[10px] font-mono uppercase tracking-widest">
                    Dispatch
                  </span>
                </div>
                <p className="font-display text-2xl font-bold mt-1">24 hrs</p>
                <p className="text-xs text-white/60 mt-0.5">
                  Same-day if before 4 PM
                </p>
              </div>
              <div>
                <div className="flex items-center gap-2 text-brand-red">
                  <Truck size={16} aria-hidden />
                  <span className="text-[10px] font-mono uppercase tracking-widest">
                    Pan-India
                  </span>
                </div>
                <p className="font-display text-2xl font-bold mt-1">2–4 days</p>
                <p className="text-xs text-white/60 mt-0.5">
                  Shiprocket · COD ready
                </p>
              </div>
            </div>

            {/* Bottom: store coming soon banner */}
            <div className="relative bg-white/5 border border-white/10 rounded-xl p-4 backdrop-blur-sm">
              <div className="flex items-center gap-2">
                <MapPin size={16} className="text-brand-red" aria-hidden />
                <span className="text-[10px] font-mono uppercase tracking-widest text-brand-red font-semibold">
                  Flagship store
                </span>
                <span className="ml-auto text-[10px] font-mono uppercase tracking-widest text-white/40">
                  Coming soon
                </span>
              </div>
              <p className="text-sm text-white/80 mt-2 leading-snug">
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
          <p className="text-xs font-mono font-bold uppercase tracking-widest text-brand-red">
            Our Story
          </p>
          <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold text-brand-ink mt-2 leading-tight text-balance">
            Why Bangalore gifts <br className="hidden sm:block" />
            <span className="text-brand-red">{THEME.brandName}</span>
          </h2>
          <p className="text-base text-brand-ink-soft mt-4 leading-relaxed">
            Designed, packed, and shipped from{" "}
            <strong className="text-brand-ink font-semibold">
              Yelahanka, Bengaluru
            </strong>
            . Real people, real warehouse, real WhatsApp number — not a
            drop-shipper.
          </p>

          <ul className="mt-7 space-y-5">
            {STORY_POINTS.map((p, i) => (
              <li key={p.title} className="flex items-start gap-4">
                <span className="shrink-0 w-9 h-9 rounded-full border-2 border-brand-line text-brand-ink-soft font-mono font-bold text-sm flex items-center justify-center">
                  0{i + 1}
                </span>
                <div className="pt-0.5">
                  <h3 className="font-display text-lg font-bold text-brand-ink">
                    {p.title}
                  </h3>
                  <p className="text-sm text-brand-ink-soft leading-relaxed mt-1">
                    {p.body}
                  </p>
                </div>
              </li>
            ))}
          </ul>

          <Link
            href="/#sku"
            className="mt-7 inline-flex items-center gap-2 text-sm font-semibold text-brand-red border-b-2 border-brand-red pb-1 hover:gap-3 transition-all"
          >
            Pick your drift — from ₹1,299
            <ArrowRight size={16} />
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
