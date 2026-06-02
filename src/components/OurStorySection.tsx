"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { Star, ArrowRight } from "lucide-react";

const STOREFRONT_SRC = "/store/bch-storefront.jpg";

const STORY_POINTS = [
  {
    title: "We Pick What Lasts",
    body:
      "We don't drop-ship random toys. Every chassis is tested on tile, marble, and concrete before it earns a spot in our box. Picked by hand, by people who actually drive them.",
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
  const [imgFailed, setImgFailed] = useState(false);

  return (
    <section
      id="our-story"
      className="py-16 sm:py-24 bg-white"
      aria-label="Our story and Bangalore store location"
    >
      <div className="max-w-6xl mx-auto px-4 grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-14 items-center">
        {/* Left: storefront photo + rating card */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: "-15%" }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="relative"
        >
          <div className="relative aspect-[4/5] sm:aspect-[5/6] rounded-2xl overflow-hidden bg-brand-cream border border-brand-line">
            {!imgFailed ? (
              <Image
                src={STOREFRONT_SRC}
                alt="Bharath Cycle Hub storefront — Yelahanka, Bengaluru. PRC Cars is operated by BCH."
                fill
                sizes="(max-width: 1024px) 90vw, 50vw"
                className="object-cover object-center"
                onError={() => setImgFailed(true)}
              />
            ) : (
              // Soft placeholder until /store/bch-storefront.jpg is dropped in.
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6 bg-gradient-to-br from-brand-cream via-white to-brand-cream">
                <div className="w-16 h-16 rounded-full bg-brand-red/10 flex items-center justify-center mb-3">
                  <Star size={24} className="text-brand-red fill-brand-red" />
                </div>
                <p className="font-display text-xl font-bold text-brand-ink">
                  Storefront photo
                </p>
                <p className="text-sm text-brand-ink-soft mt-1 max-w-xs">
                  Drop the image at{" "}
                  <span className="font-mono text-xs">
                    public/store/bch-storefront.jpg
                  </span>
                </p>
              </div>
            )}
          </div>

          {/* Floating Google Rating card */}
          <div className="absolute -bottom-4 -right-2 sm:bottom-6 sm:right-6 bg-white rounded-xl shadow-xl border border-brand-line px-4 py-3 flex flex-col items-center min-w-[120px]">
            <div className="text-2xl font-display font-bold text-brand-red leading-none">
              4.9
            </div>
            <div className="flex items-center gap-0.5 mt-1.5">
              {[0, 1, 2, 3, 4].map((i) => (
                <Star
                  key={i}
                  size={11}
                  className="text-gold fill-gold"
                  aria-hidden
                />
              ))}
            </div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-brand-ink mt-1">
              Google Rating
            </p>
            <p className="text-[10px] text-brand-ink-soft">500+ Reviews</p>
          </div>
        </motion.div>

        {/* Right: copy + numbered pillars + CTA */}
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
            <span className="text-brand-red">PRC Cars</span>
          </h2>
          <p className="text-base text-brand-ink-soft mt-4 leading-relaxed">
            Operated by{" "}
            <strong className="text-brand-ink font-semibold">
              Bharath Cycle Hub
            </strong>{" "}
            — serving Bangalore families since 1987. The same shop that puts
            kids on their first bicycle now ships their first RC drift car.
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
