"use client";

import { motion } from "framer-motion";
import { MapPin, Truck, RefreshCw } from "lucide-react";

/**
 * Honest trust strip — replaces the previous "10K+ shipped / 500+ 5-star /
 * 4.9 avg" vanity numbers. A brand-new store cannot back those claims, and
 * unverifiable aggregates actively read as dropshipper behaviour to
 * scam-wary buyers. Three concrete, verifiable facts instead.
 */
const FACTS = [
  { icon: MapPin, title: "Yelahanka HQ" },
  { icon: Truck, title: "Pan-India COD" },
  { icon: RefreshCw, title: "7-day replacement" },
] as const;

export default function StatsStrip() {
  return (
    <section
      className="py-4 sm:py-6 bg-brand-ink text-white"
      aria-label="What you're actually getting"
    >
      <div className="max-w-6xl mx-auto px-4 grid grid-cols-3 gap-4 sm:gap-10">
        {FACTS.map((fact, i) => {
          const Icon = fact.icon;
          return (
            <motion.div
              key={fact.title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.12, ease: "easeOut" }}
              className="flex items-center justify-center gap-2 text-center"
            >
              <Icon
                className="w-4 h-4 sm:w-5 sm:h-5 text-brand-red shrink-0"
                aria-hidden
              />
              <span className="font-display text-sm sm:text-base font-bold leading-tight">
                {fact.title}
              </span>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
