"use client";

import { motion } from "framer-motion";
import {
  Gift,
  CreditCard,
  Package,
  Zap,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { OFFERS } from "@/lib/config";
import { formatINR } from "@/lib/utils";

type Offer = {
  icon: LucideIcon;
  title: string;
  sub: string;
};

const OFFERS_LIST: Offer[] = [
  {
    icon: Gift,
    title: "Free drift wheels",
    sub: "Extra wheels FREE · worth ₹199",
  },
  {
    icon: CreditCard,
    title: `Prepaid ₹${OFFERS.prepaidDiscountINR} off`,
    sub: `Pay online → ${formatINR(1299 - OFFERS.prepaidDiscountINR)}`,
  },
  {
    icon: Package,
    title: "Buy-2 bundle",
    sub: `Mix 2 → ${formatINR(OFFERS.bundle2PriceINR)} · save ${formatINR(OFFERS.bundle2SaveINR)}`,
  },
  {
    icon: Zap,
    title: "Festival drop",
    sub: "Launch price · 24-hr dispatch",
  },
  {
    icon: Sparkles,
    title: `LED upgrade +${formatINR(OFFERS.ledSmokeUpgradeINR)}`,
    sub: "Full-body LED + driver figurine",
  },
];

export default function OfferStack() {
  return (
    <section className="py-8 sm:py-14 bg-brand-cream">
      <div className="max-w-5xl mx-auto px-4">
        <div className="text-center">
          <p className="text-xs font-mono font-bold uppercase tracking-widest text-brand-red">
            Stack &apos;em up
          </p>
          <h2 className="text-2xl sm:text-3xl font-bold text-brand-ink mt-1">
            Five offers. One cart.
          </h2>
        </div>

        {/* Mobile: horizontal snap-scroll. Desktop: 3/5 col grid. */}
        <div className="mt-6 sm:mt-8 -mx-4 sm:mx-0 overflow-x-auto sm:overflow-visible snap-x snap-mandatory sm:snap-none no-scrollbar">
          <div className="flex sm:grid sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 px-4 sm:px-0 pb-2 sm:pb-0">
            {OFFERS_LIST.map((offer, i) => {
              const Icon = offer.icon;
              return (
                <motion.div
                  key={offer.title}
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.35, delay: i * 0.06, ease: "easeOut" }}
                  className="snap-center shrink-0 w-[72%] sm:w-auto bg-white rounded-xl border border-brand-line p-4 sm:p-5 hover:border-brand-red hover:shadow-md transition-all"
                >
                  <div className="w-11 h-11 rounded-lg bg-brand-red-soft text-brand-red flex items-center justify-center mb-3">
                    <Icon size={20} aria-hidden />
                  </div>
                  <div className="font-semibold text-brand-ink text-base leading-tight">
                    {offer.title}
                  </div>
                  <div className="text-sm text-brand-ink-soft mt-1.5 leading-snug">
                    {offer.sub}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
