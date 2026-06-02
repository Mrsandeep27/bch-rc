"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ShoppingBag } from "lucide-react";
import { useCart } from "@/lib/cart-store";
import { getHeroSku, type Sku } from "@/lib/products";
import { formatINR } from "@/lib/utils";

/**
 * Mobile-only sticky bottom bar. On the home page it shows the hero SKU;
 * on a PDP pass the current SKU so "Add" loads THAT product into the cart.
 */
export default function StickyMobileCTA({ sku }: { sku?: Sku }) {
  const [visible, setVisible] = useState<boolean>(false);
  const hero = sku ?? getHeroSku();

  useEffect(() => {
    const onScroll = () => {
      setVisible(window.scrollY > 600);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const handleAdd = () => {
    useCart.getState().add(hero.id);
    useCart.getState().open();
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="sticky-mobile-cta"
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: "spring", stiffness: 400, damping: 32 }}
          className="sm:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-brand-line px-4 py-2.5 flex items-center justify-between gap-3 shadow-2xl"
          style={{ paddingBottom: "max(0.625rem, env(safe-area-inset-bottom))" }}
        >
          <div className="min-w-0">
            <div className="text-[10px] font-mono uppercase tracking-widest text-brand-ink-soft truncate">
              {hero.name}
            </div>
            <div className="text-lg font-bold text-brand-ink leading-tight">
              {formatINR(hero.retailINR)}
              <span className="ml-1.5 text-xs text-brand-ink-soft line-through font-normal">
                {formatINR(hero.mrpINR)}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={handleAdd}
            className="bg-brand-red hover:bg-brand-red-hover text-white px-5 py-3 rounded-full font-semibold text-sm inline-flex items-center gap-2 shrink-0 min-h-[44px]"
          >
            <ShoppingBag size={16} />
            Add
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
