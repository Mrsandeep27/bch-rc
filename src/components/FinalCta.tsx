"use client";

import { useCart } from "@/lib/cart-store";
import { defaultVariantSlug, getHeroSku } from "@/lib/products";

export default function FinalCta() {
  const handleAdd = () => {
    const hero = getHeroSku();
    useCart.getState().add(hero.id, defaultVariantSlug(hero));
    useCart.getState().open();
  };

  return (
    <section className="py-8 sm:py-16 bg-brand-red text-white">
      <div className="max-w-3xl mx-auto px-4 text-center">
        {/* F01 - restate the SAME gifting promise the hero opened with, plus
            the close-the-gift reframe ("his face when he drifts it"). The
            close-out repeats the buyer's job (giver) and the recipient's
            payoff (joy + use), then puts the relievers right under the
            button per Voss accusation-audit. */}
        <p className="font-mono text-[11px] sm:text-xs uppercase tracking-widest text-white/80">
          One last time —
        </p>
        <h2 className="mt-2 text-2xl sm:text-3xl md:text-4xl font-bold text-white text-balance leading-tight">
          The gift you&apos;ll watch him use for months.
        </h2>
        <p className="mt-3 text-sm sm:text-base text-white/90 max-w-xl mx-auto text-balance">
          ₹999 online or ₹1,099 COD. Gift-ready box. Ships in 24 hrs from
          Bangalore. Pay nothing now if you don&apos;t want to.
        </p>
        <button
          type="button"
          onClick={handleAdd}
          className="mt-5 sm:mt-7 bg-white text-brand-red hover:bg-brand-cream px-6 sm:px-8 py-3 sm:py-4 rounded-full font-bold text-sm sm:text-lg inline-flex items-center gap-2 shadow-2xl"
        >
          🛒 Order his gift — from ₹999, COD
        </button>
        <p className="mt-3 text-[11px] sm:text-xs text-white/80 font-mono uppercase tracking-widest">
          Pay on delivery · 7-day replacement · real WhatsApp support
        </p>
      </div>
    </section>
  );
}
