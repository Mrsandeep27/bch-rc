"use client";

/**
 * F03 — Three-question mini-FAQ placed immediately after the hero, before
 * the lineup. Clears the decisive objections at the decision pixel instead
 * of leaving them for the bottom-of-page full FAQ to handle after every
 * buy button has already fired.
 *
 * Order matters: COD first (the #1 India-RC blocker), size second (the
 * "is this a real RC car?" doubt), durability third (the parents' /
 * gifters' anxiety about a dud toy). Same three concerns the full FAQ
 * answers in detail; this is a 3-bullet headline preview so the buyer
 * doesn't have to scroll past everything to find them.
 *
 * Why a dedicated component instead of reusing FAQ:
 *   - The full <FAQ /> renders 8+ entries and is collapsed by default —
 *     too much surface to live above the lineup.
 *   - The mini version is always-expanded (no tap to open) so the
 *     answers are scannable on first scroll.
 *   - It's deliberately small in size — it's an objection-strip, not a
 *     section the buyer has to read line-by-line.
 */

import { ShieldCheck, Ruler, Wrench } from "lucide-react";

const ITEMS = [
  {
    icon: ShieldCheck,
    q: "COD?",
    a: "Yes, pan-India. Pay courier on delivery.",
  },
  {
    icon: Ruler,
    q: "How small?",
    a: "Palm-size (~7 cm). Drifts on tile + marble.",
  },
  {
    icon: Wrench,
    q: "If it breaks?",
    a: "7-day replacement. Spares ₹99–199. Real WhatsApp.",
  },
] as const;

export default function HeroMiniFaq() {
  return (
    <section
      aria-label="Top questions before you buy"
      className="bg-brand-cream border-y border-brand-line"
    >
      <div className="max-w-5xl mx-auto px-4 py-3 sm:py-4">
        <p className="text-[10px] font-mono uppercase tracking-widest text-brand-red text-center">
          Before you tap order —
        </p>
        <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-2">
          {ITEMS.map(({ icon: Icon, q, a }) => (
            <div
              key={q}
              className="flex items-start gap-2 bg-white border border-brand-line rounded-lg p-2 sm:p-2.5"
            >
              <span className="shrink-0 w-6 h-6 rounded bg-brand-red-soft text-brand-red flex items-center justify-center">
                <Icon size={12} aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-brand-ink text-xs sm:text-sm leading-snug">
                  {q}
                </div>
                <div className="text-[11px] sm:text-xs text-brand-ink-soft mt-0.5 leading-snug">
                  {a}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
