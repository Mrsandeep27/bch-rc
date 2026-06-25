"use client";

/**
 * 1:16 mirror of the 1:64 <HowToUse />. Identical layout — bg-brand-cream band,
 * 3 white cards with an icon chip, a corner number badge, title, one-line body
 * and a mono detail strip, with the same framer-motion reveal. Copy is driven
 * by STORE16.howSteps; the icon + detail per step live here. Colours come from
 * the .store-16 scope (slate accent).
 */

import { motion } from "framer-motion";
import { BatteryCharging, Gauge, RotateCcw } from "lucide-react";
import { STORE16 } from "@/lib/store16";

const META = [
  { icon: BatteryCharging, detail: "USB-C · built-in" },
  { icon: Gauge, detail: "proportional · 4WD" },
  { icon: RotateCcw, detail: "drift tyres · smooth floor" },
] as const;

export default function HowToUse16() {
  return (
    <section
      aria-labelledby="how16-title"
      className="bg-brand-cream border-y border-brand-line"
    >
      <div className="max-w-6xl mx-auto px-4 py-6 sm:py-10">
        <header className="text-center mb-4 sm:mb-8">
          <p className="text-[10px] sm:text-xs font-mono uppercase tracking-widest text-brand-red">
            {STORE16.howEyebrow}
          </p>
          <h2
            id="how16-title"
            className="font-display text-xl sm:text-4xl font-bold text-brand-ink mt-1 sm:mt-2"
          >
            {STORE16.howH2}
          </h2>
          <p className="hidden sm:block text-sm sm:text-base text-brand-ink-soft mt-2 max-w-xl mx-auto">
            From charged to first slide in minutes.
          </p>
        </header>

        <ol className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-5">
          {STORE16.howSteps.map((step, i) => {
            const Icon = META[i].icon;
            const n = String(i + 1).padStart(2, "0");
            return (
              <motion.li
                key={step.t}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.4, delay: i * 0.1, ease: "easeOut" }}
                className="relative bg-white border border-brand-line rounded-xl sm:rounded-2xl p-3 sm:p-6 flex flex-row items-center gap-3 sm:flex-col sm:items-stretch sm:gap-0 shadow-sm"
              >
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
                    {step.t}
                  </h3>
                  <p className="text-xs sm:text-sm text-brand-ink-soft mt-0.5 sm:mt-1.5 leading-snug sm:leading-relaxed">
                    {step.d}
                  </p>
                  <p className="hidden sm:block sm:mt-3 sm:pt-3 sm:border-t sm:border-brand-line text-[10px] font-mono uppercase tracking-widest text-brand-ink-soft">
                    {META[i].detail}
                  </p>
                </div>
              </motion.li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
