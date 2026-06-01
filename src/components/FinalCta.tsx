"use client";

import { useCart } from "@/lib/cart-store";
import { getHeroSku } from "@/lib/products";
import { waLink } from "@/lib/config";

export default function FinalCta() {
  const handleAdd = () => {
    useCart.getState().add(getHeroSku().id);
    useCart.getState().open();
  };

  return (
    <section className="py-14 sm:py-20 bg-brand-red text-white">
      <div className="max-w-3xl mx-auto px-4 text-center">
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white text-balance">
          Order now — dispatched in 24 hrs from Bangalore.
        </h2>
        <div className="mt-8">
          <button
            type="button"
            onClick={handleAdd}
            className="bg-white text-brand-red hover:bg-brand-cream px-8 py-4 rounded-full font-bold text-base sm:text-lg inline-flex items-center gap-2 shadow-2xl"
          >
            🛒 Shop the Hero — ₹1,299
          </button>
          <a
            className="block text-white/90 hover:text-white text-sm underline-offset-4 hover:underline mt-4"
            href={waLink("Hi, I want to order the mini RC drift car.")}
            target="_blank"
            rel="noopener"
          >
            or DM us on WhatsApp →
          </a>
        </div>
      </div>
    </section>
  );
}
