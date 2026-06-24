"use client";

import { useCart } from "@/lib/cart-store";
import { defaultVariantSlug, getVisibleProducts } from "@/lib/products";
import { OFFERS } from "@/lib/config";
import { formatINR } from "@/lib/utils";

export default function FinalCta() {
  // Lead with the ACTUAL cheapest car so the "from ₹999" promise and the cart
  // land on the same number. Was: hardcoded "₹999" copy but handleAdd added the
  // ₹1,399 hero Porsche → a ₹300/₹400 jump the moment the cart opened.
  const entry = getVisibleProducts().reduce((min, p) =>
    p.retailINR < min.retailINR ? p : min,
  );
  const online = entry.retailINR - OFFERS.prepaidDiscountINR;
  const cod = entry.retailINR;

  const handleAdd = () => {
    useCart.getState().add(entry.id, defaultVariantSlug(entry));
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
          {formatINR(online)} online · {formatINR(cod)} COD · ships from
          Bangalore
        </p>
        <button
          type="button"
          onClick={handleAdd}
          className="mt-4 sm:mt-6 bg-white text-brand-red hover:bg-brand-cream px-6 sm:px-8 py-3 sm:py-4 rounded-full font-bold text-sm sm:text-lg inline-flex items-center gap-2 shadow-2xl"
        >
          🛒 Order his gift — {formatINR(online)}, COD
        </button>
        <p className="mt-3 text-[11px] sm:text-xs text-white/80 font-mono uppercase tracking-widest">
          COD · 7-day replacement · WhatsApp
        </p>
      </div>
    </section>
  );
}
