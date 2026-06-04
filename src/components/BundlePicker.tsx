"use client";

import { useState } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { Check, ShoppingBag, Plus } from "lucide-react";
import { THEME } from "@/lib/theme";
import { getHeroSku } from "@/lib/products";
import { useCart } from "@/lib/cart-store";
import { formatINR, cn } from "@/lib/utils";

type BundleOption = {
  qty: 1 | 2 | 3;
  label: string;
  priceINR: number;
  perCarINR: number;
  saveINR: number;
  badge?: "MOST POPULAR" | "BEST VALUE";
  sub: string;
  cars: { src: string; alt: string }[];
};

const SINGLE_PRICE = getHeroSku().retailINR;

const CAR_BMW = { src: "/products/PRC-bmw.webp", alt: "Pocket BMW" };
const CAR_PORSCHE = { src: "/products/PRC-porsche.webp", alt: "Pocket Porsche" };
const CAR_MONSTER = { src: "/products/PRC-monster.webp", alt: "Pocket Monster Truck" };

const OPTIONS: BundleOption[] = [
  {
    qty: 1,
    label: "Buy 1",
    priceINR: SINGLE_PRICE,
    perCarINR: SINGLE_PRICE,
    saveINR: 0,
    sub: "Just for me",
    cars: [CAR_BMW],
  },
  {
    qty: 2,
    label: "Buy 2",
    priceINR: THEME.bundle2PriceINR,
    perCarINR: Math.round(THEME.bundle2PriceINR / 2),
    saveINR: THEME.bundle2SaveINR,
    badge: "MOST POPULAR",
    sub: "Gift + keep",
    cars: [CAR_BMW, CAR_PORSCHE],
  },
  {
    qty: 3,
    label: "Buy 3",
    priceINR: THEME.bundle3PriceINR,
    perCarINR: Math.round(THEME.bundle3PriceINR / 3),
    saveINR: THEME.bundle3SaveINR,
    badge: "BEST VALUE",
    sub: "Race night",
    cars: [CAR_BMW, CAR_PORSCHE, CAR_MONSTER],
  },
];

export default function BundlePicker() {
  const [selectedQty, setSelectedQty] = useState<1 | 2 | 3>(2);

  const selected = OPTIONS.find((o) => o.qty === selectedQty)!;

  const handleAdd = () => {
    const hero = getHeroSku();
    // Default to the first in-stock colour for the hero SKU. If the SKU has
    // no colour variants, pass null.
    const firstInStock =
      hero.colors?.find((c) => c.stock > 0)?.slug ?? hero.colors?.[0]?.slug ?? null;
    const { add, open } = useCart.getState();
    add(hero.id, firstInStock, selectedQty);
    open();
  };

  return (
    <section id="bundles" className="py-6 sm:py-14 bg-brand-cream">
      <div className="max-w-5xl mx-auto px-4">
        <div className="text-center">
          <span className="font-mono text-[11px] sm:text-xs uppercase tracking-widest text-brand-red">
            Bundle &amp; save
          </span>
          <h2 className="font-display text-2xl sm:text-5xl font-bold text-brand-ink mt-1.5 sm:mt-2 text-balance">
            More cars. Bigger savings.
          </h2>
          <p className="text-brand-ink-soft text-sm sm:text-lg mt-2 sm:mt-3 max-w-xl mx-auto">
            Mix any cars. The more you stack, the lower the per-car price.
          </p>
        </div>

        {/* Mobile: horizontal snap-scroll (3 cards, swipe). Desktop: 3-col grid. */}
        <div className="mt-4 sm:mt-10 -mx-4 sm:mx-0 overflow-x-auto sm:overflow-visible snap-x snap-mandatory sm:snap-none no-scrollbar">
          <div className="flex items-start sm:items-stretch sm:grid sm:grid-cols-3 gap-3 sm:gap-6 px-4 sm:px-0 pb-2 sm:pb-0 pt-3 sm:pt-0">
          {OPTIONS.map((opt, i) => {
            const isSelected = opt.qty === selectedQty;
            return (
              <motion.button
                key={opt.qty}
                type="button"
                onClick={() => setSelectedQty(opt.qty)}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.08, ease: "easeOut" }}
                className={cn(
                  "snap-center shrink-0 w-[82%] sm:w-auto relative text-center bg-white rounded-2xl p-4 sm:p-7 border-2 transition-all",
                  isSelected
                    ? "border-brand-red shadow-2xl scale-[1.02]"
                    : "border-brand-line hover:border-brand-ink/40 hover:shadow-md"
                )}
                aria-pressed={isSelected}
              >
                {opt.badge && (
                  <span
                    className={cn(
                      "absolute -top-3 left-1/2 -translate-x-1/2 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full whitespace-nowrap",
                      opt.badge === "MOST POPULAR"
                        ? "bg-brand-red text-white"
                        : "bg-brand-ink text-white"
                    )}
                  >
                    {opt.badge}
                  </span>
                )}

                <span
                  className={cn(
                    "absolute top-3 right-3 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors",
                    isSelected
                      ? "border-brand-red bg-brand-red text-white"
                      : "border-brand-line"
                  )}
                  aria-hidden
                >
                  {isSelected && <Check size={14} strokeWidth={3} />}
                </span>

                <span className="block font-mono text-[11px] sm:text-xs uppercase tracking-widest text-brand-ink font-semibold">
                  {opt.sub}
                </span>

                <h3 className="font-display text-2xl sm:text-4xl font-bold text-brand-ink mt-2 sm:mt-3">
                  {opt.label}
                </h3>

                <div
                  className="mt-2 sm:mt-3 flex items-center justify-center gap-1 sm:gap-1.5"
                  aria-hidden
                >
                  {opt.cars.map((car, idx) => (
                    <div key={idx} className="flex items-center gap-1 sm:gap-1.5">
                      {idx > 0 && (
                        <Plus
                          size={12}
                          strokeWidth={2.5}
                          className="text-brand-ink-soft shrink-0"
                        />
                      )}
                      <div className="relative w-10 h-10 sm:w-14 sm:h-14 rounded-lg bg-brand-cream border border-brand-line overflow-hidden shrink-0">
                        <Image
                          src={car.src}
                          alt={car.alt}
                          fill
                          sizes="56px"
                          className="object-cover"
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-3 sm:mt-4 flex items-baseline justify-center gap-2 flex-wrap">
                  <span className="text-2xl sm:text-3xl font-bold text-brand-ink">
                    {formatINR(opt.priceINR)}
                  </span>
                  {opt.saveINR > 0 && (
                    <span className="text-sm text-brand-ink-soft line-through">
                      {formatINR(SINGLE_PRICE * opt.qty)}
                    </span>
                  )}
                </div>

                <div className="mt-1 text-xs sm:text-sm text-brand-ink-soft font-mono font-medium">
                  {formatINR(opt.perCarINR)} per car
                </div>

                <div className="mt-2.5 sm:mt-3 inline-block bg-success/10 text-success text-xs font-bold px-2.5 py-1 rounded-full">
                  {opt.saveINR > 0
                    ? `SAVE ${formatINR(opt.saveINR)}`
                    : "FREE SHIPPING"}
                </div>
              </motion.button>
            );
          })}
          </div>
        </div>

        <div className="mt-5 sm:mt-10 flex flex-col items-center">
          <button
            type="button"
            onClick={handleAdd}
            className="bg-brand-red hover:bg-brand-red-hover text-white px-7 sm:px-8 py-3.5 sm:py-5 rounded-full font-semibold text-base sm:text-lg shadow-2xl transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center gap-2"
          >
            <ShoppingBag size={20} aria-hidden />
            Add {selectedQty} {selectedQty === 1 ? "car" : "cars"} — {formatINR(selected.priceINR)}
          </button>
          <p className="text-brand-ink text-[11px] sm:text-sm mt-2.5 sm:mt-3 font-mono font-medium text-center">
            Free shipping · COD pan-India · 24-hr dispatch
          </p>
        </div>
      </div>
    </section>
  );
}
