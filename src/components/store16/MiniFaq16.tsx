"use client";

/**
 * 1:16 mirror of the 1:64 <HeroMiniFaq />. Same job: clear the three
 * decisive objections (COD, size, durability) right at the decision pixel,
 * immediately after the hero and before the lineup — instead of leaving them
 * for the bottom-of-page FAQ to handle after every buy button has fired.
 *
 * Copy differs from the 1:64 version on the one axis that matters here: size.
 * The pocket cars apologise for being small ("palm-size, still drifts"); the
 * 1:16 series leads with the opposite flex — it's the big, display-and-drive
 * build. Everything else (COD, 7-day swap) is the shared PRC promise.
 *
 * Colour discipline matches the rest of /16: the only non-neutral is the
 * slate-blue accent (brand-red token → #3A5069 via the .store-16 scope).
 */

import { ShieldCheck, Ruler, Wrench } from "lucide-react";

const ITEMS = [
  {
    icon: ShieldCheck,
    q: "COD?",
    a: "Yes, pan-India",
    aFull: "Yes, pan-India. Pay courier on delivery.",
  },
  {
    icon: Ruler,
    q: "Size?",
    a: "Big · 1:16",
    aFull: "Display-and-drive size. Rubber tyres, pistol-grip remote.",
  },
  {
    icon: Wrench,
    q: "Breaks?",
    a: "7-day swap",
    aFull: "7-day replacement. Spares on WhatsApp. Real humans.",
  },
] as const;

export default function MiniFaq16() {
  return (
    <section
      aria-label="Top questions before you buy"
      className="bg-brand-cream border-b border-brand-line"
    >
      <div className="max-w-5xl mx-auto px-4 py-2 sm:py-4">
        <p className="hidden sm:block text-[10px] font-mono uppercase tracking-widest text-brand-red text-center">
          Before you tap order —
        </p>
        <div className="grid grid-cols-3 gap-1.5 sm:gap-2 sm:mt-2">
          {ITEMS.map(({ icon: Icon, q, a, aFull }) => (
            <div
              key={q}
              className="flex sm:items-start gap-1.5 sm:gap-2 bg-white border border-brand-line rounded-md sm:rounded-lg px-1.5 py-1.5 sm:p-2.5 shadow-sm"
            >
              <span className="shrink-0 w-5 h-5 sm:w-6 sm:h-6 rounded bg-brand-red-soft text-brand-red flex items-center justify-center self-center sm:self-start">
                <Icon size={11} aria-hidden />
              </span>
              <div className="min-w-0 flex-1 leading-tight">
                <div className="font-semibold text-brand-ink text-[11px] sm:text-sm">
                  {q}
                </div>
                <div className="text-[10px] sm:text-xs text-brand-ink-soft sm:mt-0.5 sm:hidden">
                  {a}
                </div>
                <div className="hidden sm:block text-xs text-brand-ink-soft mt-0.5">
                  {aFull}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
