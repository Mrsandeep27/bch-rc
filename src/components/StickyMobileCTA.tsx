"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ShoppingBag } from "lucide-react";
import { useCart } from "@/lib/cart-store";
import { getHeroSku } from "@/lib/products";

export default function StickyMobileCTA() {
  const [visible, setVisible] = useState<boolean>(false);

  useEffect(() => {
    const onScroll = () => {
      setVisible(window.scrollY > 600);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const handleAdd = () => {
    useCart.getState().add(getHeroSku().id);
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
          className="sm:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-brand-line px-4 py-3 flex items-center justify-between gap-3 shadow-2xl"
        >
          <div>
            <div className="text-[10px] uppercase tracking-widest text-brand-ink-soft">
              Storm · 1:43
            </div>
            <div className="text-lg font-bold text-brand-ink">₹1,199</div>
          </div>
          <button
            type="button"
            onClick={handleAdd}
            className="bg-brand-red hover:bg-brand-red-hover text-white px-5 py-3 rounded-full font-semibold text-sm inline-flex items-center gap-2"
          >
            <ShoppingBag size={16} />
            Add to Cart
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
