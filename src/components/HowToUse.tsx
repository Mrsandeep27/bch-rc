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
      {/* Mobile compact: icon-left rows so all 3 steps fit in one viewport on
          iPhone SE. Desktop keeps the original card-grid layout — sub-headline,
          per-card detail strip and the big number badge all return at sm+. */}
      <div className="max-w-6xl mx-auto px-4 py-7 sm:py-16">
        <header className="text-center mb-4 sm:mb-12">
          <p className="text-[10px] sm:text-xs font-mono uppercase tracking-widest text-brand-red">
            How it works
          </p>
          <h2
            id="how-to-use-title"
            className="font-display text-xl sm:text-4xl font-bold text-brand-ink mt-1 sm:mt-2"
          >
            Three steps. No app. No manual.
          </h2>
          <p className="hidden sm:block text-sm sm:text-base text-brand-ink-soft mt-2 max-w-xl mx-auto">
            Out of the box to first drift in under 30 minutes.
          </p>
        </header>

        <ol className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-5">
          {STEPS.map(({ n, icon: Icon, title, body, detail }, i) => (
            <motion.li
              key={n}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.4, delay: i * 0.1, ease: "easeOut" }}
              className="relative bg-white border border-brand-line rounded-xl sm:rounded-2xl p-3 sm:p-6 flex flex-row items-center gap-3 sm:flex-col sm:items-stretch sm:gap-0"
            >
              {/* Desktop-only number badge sits in the top-right corner;
                  mobile drops it (order is already obvious from the row
                  position in the list). */}
              <span
                aria-hidden
                className="hidden sm:inline-block absolute top-6 right-6 font-mono text-xs tracking-widest text-brand-ink-soft/60"
              >
                {n}
              </span>

              <span className="shrink-0 inline-flex items-center justify-center w-10 h-10 rounded-xl bg-brand-red-soft text-brand-red">
                <Icon size={20} aria-hidden />
              </span>

              <div className="min-w-0 flex-1 sm:mt-4">
                <h3 className="font-display text-base sm:text-xl font-bold text-brand-ink leading-tight">
                  {title}
                </h3>
                <p className="text-xs sm:text-sm text-brand-ink-soft mt-0.5 sm:mt-1.5 leading-snug sm:leading-relaxed">
                  {body}
                </p>
                <p className="hidden sm:block sm:mt-3 sm:pt-3 sm:border-t sm:border-brand-line text-[10px] font-mono uppercase tracking-widest text-brand-ink-soft">
                  {detail}
                </p>
              </div>
            </motion.li>
          ))}
        </ol>
      </div>
    </section>
  );
}
