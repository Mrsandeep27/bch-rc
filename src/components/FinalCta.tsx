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
    <section className="py-6 sm:py-12 bg-brand-red text-white">
      <div className="max-w-3xl mx-auto px-4 text-center">
        {/* F01 - close-out restates the gifting promise. Trust strip lives
            once, under the button, instead of repeating the relievers
            already covered upstream. */}
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white text-balance leading-tight">
          The gift he&apos;ll use for months.
        </h2>
        <p className="mt-2 text-sm sm:text-base text-white/90">
          ₹999 online · ₹1,099 COD · ships from Bangalore
        </p>
        <button
          type="button"
          onClick={handleAdd}
          className="mt-4 sm:mt-6 bg-white text-brand-red hover:bg-brand-cream px-6 sm:px-8 py-3 sm:py-4 rounded-full font-bold text-sm sm:text-lg inline-flex items-center gap-2 shadow-2xl"
        >
          🛒 Order his gift — ₹999, COD
        </button>
        <p className="mt-3 text-[11px] sm:text-xs text-white/80 font-mono uppercase tracking-widest">
          COD · 7-day replacement · WhatsApp
        </p>
      </div>
    </section>
  );
}
