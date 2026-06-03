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
        <h2 className="text-xl sm:text-3xl md:text-4xl font-bold text-white text-balance leading-tight">
          Order now — dispatched in 24 hrs from Bangalore.
        </h2>
        <button
          type="button"
          onClick={handleAdd}
          className="mt-4 sm:mt-6 bg-white text-brand-red hover:bg-brand-cream px-6 sm:px-8 py-3 sm:py-4 rounded-full font-bold text-sm sm:text-lg inline-flex items-center gap-2 shadow-2xl"
        >
          🛒 Shop the Hero — ₹1,299
        </button>
      </div>
    </section>
  );
}
