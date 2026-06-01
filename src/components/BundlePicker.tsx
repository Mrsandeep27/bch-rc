"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Check, ShoppingBag } from "lucide-react";
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
};

const SINGLE_PRICE = 1299;

const OPTIONS: BundleOption[] = [
  {
    qty: 1,
    label: "Buy 1",
    priceINR: SINGLE_PRICE,
    perCarINR: SINGLE_PRICE,
    saveINR: 0,
    sub: "Just for me",
  },
  {
    qty: 2,
    label: "Buy 2",
    priceINR: THEME.bundle2PriceINR,
    perCarINR: Math.round(THEME.bundle2PriceINR / 2),
    saveINR: THEME.bundle2SaveINR,
    badge: "MOST POPULAR",
    sub: "Gift + keep",
  },
  {
    qty: 3,
    label: "Buy 3",
    priceINR: THEME.bundle3PriceINR,
    perCarINR: Math.round(THEME.bundle3PriceINR / 3),
    saveINR: THEME.bundle3SaveINR,
    badge: "BEST VALUE",
    sub: "Race night",
  },
];

export default function BundlePicker() {
  const [selectedQty, setSelectedQty] = useState<1 | 2 | 3>(2);

  const selected = OPTIONS.find((o) => o.qty === selectedQty)!;

  const handleAdd = () => {
    const hero = getHeroSku();
    const { add, open } = useCart.getState();
    for (let i = 0; i < selectedQty; i++) {
      add(hero.id);
    }
    open();
  };

  return (
    <section id="bundles" className="py-16 sm:py-24 bg-brand-cream">
      <div className="max-w-5xl mx-auto px-4">
        <div className="text-center">
          <span className="font-mono text-xs uppercase tracking-widest text-brand-red">
            Bundle &amp; save
          </span>
          <h2 className="font-display text-3xl sm:text-5xl font-bold text-brand-ink mt-2 text-balance">
            More cars. Bigger savings.
          </h2>
          <p className="text-brand-ink-soft text-base sm:text-lg mt-3 max-w-xl mx-auto">
            Mix any cars — BMW, Porsche, Thar, Monster Truck, F1, Beetle. The more you stack, the lower the per-car price.
          </p>
        </div>

        <div className="mt-10 sm:mt-14 grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
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
                  "relative text-left bg-white rounded-2xl p-5 sm:p-7 border-2 transition-all",
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

                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs uppercase tracking-widest text-brand-ink-soft">
                    {opt.sub}
                  </span>
                  <span
                    className={cn(
                      "w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors",
                      isSelected
                        ? "border-brand-red bg-brand-red text-white"
                        : "border-brand-line"
                    )}
                    aria-hidden
                  >
                    {isSelected && <Check size={14} strokeWidth={3} />}
                  </span>
                </div>

                <h3 className="font-display text-3xl sm:text-4xl font-bold text-brand-ink mt-3">
                  {opt.label}
                </h3>

                <div className="mt-4 flex items-baseline gap-2 flex-wrap">
                  <span className="text-2xl sm:text-3xl font-bold text-brand-ink">
                    {formatINR(opt.priceINR)}
                  </span>
                  {opt.saveINR > 0 && (
                    <span className="text-sm text-brand-ink-soft line-through">
                      {formatINR(SINGLE_PRICE * opt.qty)}
                    </span>
                  )}
                </div>

                <div className="mt-1 text-xs sm:text-sm text-brand-ink-soft font-mono">
                  {formatINR(opt.perCarINR)} per car
                </div>

                {opt.saveINR > 0 && (
                  <div className="mt-3 inline-block bg-success/10 text-success text-xs font-bold px-2.5 py-1 rounded-full">
                    SAVE {formatINR(opt.saveINR)}
                  </div>
                )}
              </motion.button>
            );
          })}
        </div>

        <div className="mt-8 sm:mt-10 flex flex-col items-center">
          <button
            type="button"
            onClick={handleAdd}
            className="bg-brand-red hover:bg-brand-red-hover text-white px-8 py-4 sm:py-5 rounded-full font-semibold text-base sm:text-lg shadow-2xl transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center gap-2"
          >
            <ShoppingBag size={20} aria-hidden />
            Add {selectedQty} {selectedQty === 1 ? "car" : "cars"} — {formatINR(selected.priceINR)}
          </button>
          <p className="text-brand-ink-soft text-xs sm:text-sm mt-3 font-mono">
            Free shipping · COD pan-India · dispatched in 24 hrs
          </p>
        </div>
      </div>
    </section>
  );
}
