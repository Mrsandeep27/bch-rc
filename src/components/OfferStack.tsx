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
    sub: "Extra drift wheels FREE with every order (worth ₹199)",
  },
  {
    icon: CreditCard,
    title: `Prepaid ₹${OFFERS.prepaidDiscountINR} off`,
    sub: `Pay online → ${formatINR(1299 - OFFERS.prepaidDiscountINR)} (instead of ${formatINR(1299)} COD)`,
  },
  {
    icon: Package,
    title: "Buy-2 bundle",
    sub: `Mix any 2 cars → ${formatINR(OFFERS.bundle2PriceINR)} (save ${formatINR(OFFERS.bundle2SaveINR)})`,
  },
  {
    icon: Zap,
    title: "Festival drop",
    sub: "Limited stock at launch price — dispatched in 24 hrs from Bangalore",
  },
  {
    icon: Sparkles,
    title: `LED upgrade · +${formatINR(OFFERS.ledSmokeUpgradeINR)}`,
    sub: "Unlocks full-body LED + driver figurine on Pro variants",
  },
];

export default function OfferStack() {
  return (
    <section className="py-14 sm:py-20 bg-brand-cream">
      <div className="max-w-4xl mx-auto px-4">
        <h2 className="text-3xl sm:text-4xl font-bold text-brand-ink text-center">
          Stack the offers.
        </h2>

        <div className="mt-8 bg-white rounded-2xl border border-brand-line divide-y divide-brand-line shadow-sm">
          {OFFERS_LIST.map((offer, i) => {
            const Icon = offer.icon;
            return (
              <motion.div
                key={offer.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.08, ease: "easeOut" }}
                className="flex items-start sm:items-center gap-4 p-5 sm:p-6"
              >
                <div className="w-11 h-11 rounded-full bg-brand-red-soft text-brand-red flex items-center justify-center shrink-0">
                  <Icon size={20} aria-hidden />
                </div>
                <div>
                  <div className="font-semibold text-brand-ink">
                    {offer.title}
                  </div>
                  <div className="text-sm text-brand-ink-soft mt-0.5">
                    {offer.sub}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
