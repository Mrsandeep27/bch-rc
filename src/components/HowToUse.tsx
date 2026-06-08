"use client";

/**
 * 3-step "how to use it" strip. Sits below FeatureCarousel — by then the
 * buyer knows what the car DOES, and this answers the unspoken next
 * question: "ok but how do I actually use it?". One sentence per step, no
 * manual-style detail; the full setup guide lives in the unboxing card.
 *
 * Why 3 and not 5: the real flow is genuinely 3 actions (charge → pair →
 * drive). Padding it with "unbox" / "enjoy" turns instructions into filler.
 */

import { motion } from "framer-motion";
import { BatteryCharging, Power, Gauge } from "lucide-react";

const STEPS = [
  {
    n: "01",
    icon: BatteryCharging,
    title: "Charge it",
    body: "Plug USB-C. Full in ~30 min. 20 min of drift per charge.",
    detail: "USB-C · 30 min",
  },
  {
    n: "02",
    icon: Power,
    title: "Power on, auto-pair",
    body: "Flip the car switch, turn on the remote. 2.4 GHz pairs in 2 sec.",
    detail: "2.4 GHz · auto",
  },
  {
    n: "03",
    icon: Gauge,
    title: "Drive & drift",
    body: "Tile or marble for slides. Carpet for grip. Re-charge. Repeat.",
    detail: "tile · marble · wood",
  },
] as const;

export default function HowToUse() {
  return (
    <section
      aria-labelledby="how-to-use-title"
      className="bg-brand-cream border-y border-brand-line"
    >
      <div className="max-w-6xl mx-auto px-4 py-12 sm:py-16">
        <header className="text-center mb-8 sm:mb-12">
          <p className="text-[10px] sm:text-xs font-mono uppercase tracking-widest text-brand-red">
            How it works
          </p>
          <h2
            id="how-to-use-title"
            className="font-display text-2xl sm:text-4xl font-bold text-brand-ink mt-2"
          >
            Three steps. No app. No manual.
          </h2>
          <p className="text-sm sm:text-base text-brand-ink-soft mt-2 max-w-xl mx-auto">
            Out of the box to first drift in under 30 minutes.
          </p>
        </header>

        <ol className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-5">
          {STEPS.map(({ n, icon: Icon, title, body, detail }, i) => (
            <motion.li
              key={n}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.4, delay: i * 0.1, ease: "easeOut" }}
              className="relative bg-white border border-brand-line rounded-2xl p-5 sm:p-6 flex flex-col"
            >
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-brand-red-soft text-brand-red">
                  <Icon size={20} aria-hidden />
                </span>
                <span className="font-mono text-xs tracking-widest text-brand-ink-soft/60">
                  {n}
                </span>
              </div>
              <h3 className="font-display text-lg sm:text-xl font-bold text-brand-ink mt-4">
                {title}
              </h3>
              <p className="text-sm text-brand-ink-soft mt-1.5 leading-relaxed flex-1">
                {body}
              </p>
              <p className="mt-3 pt-3 border-t border-brand-line text-[10px] font-mono uppercase tracking-widest text-brand-ink-soft">
                {detail}
              </p>
            </motion.li>
          ))}
        </ol>
      </div>
    </section>
  );
}
