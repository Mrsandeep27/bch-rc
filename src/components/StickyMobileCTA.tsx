"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ShoppingBag } from "lucide-react";
import { useCart } from "@/lib/cart-store";
import { getHeroSku, type Sku } from "@/lib/products";
import { formatINR } from "@/lib/utils";

const SENTINEL_ID = "hero-end-sentinel";

/**
 * Persistent buy bar. Mobile (≤ sm) pins to the bottom; desktop appears as a
 * pill at the bottom-center. Appears the moment the user scrolls past the
 * hero's primary CTA (observed via an IntersectionObserver on
 * #hero-end-sentinel, which the home page mounts directly after <Hero />).
 *
 * On a PDP, pass the current SKU so "Add" loads THAT product, and pass a
 * matching `sentinelId` if the PDP places its own sentinel.
 */
export default function StickyMobileCTA({
  sku,
  sentinelId = SENTINEL_ID,
}: {
  sku?: Sku;
  sentinelId?: string;
}) {
  const [visible, setVisible] = useState(false);
  const hero = sku ?? getHeroSku();

  useEffect(() => {
    const target = document.getElementById(sentinelId);
    if (!target) {
      // Fallback: if for any reason the sentinel isn't mounted, fall back to
      // a scroll-position heuristic instead of staying hidden forever.
      const onScroll = () => setVisible(window.scrollY > window.innerHeight * 0.85);
      onScroll();
      window.addEventListener("scroll", onScroll, { passive: true });
      return () => window.removeEventListener("scroll", onScroll);
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        // Show once the sentinel has scrolled ABOVE the viewport (i.e. user
        // is past the hero). Don't show while the sentinel is still below or
        // intersecting the viewport.
        const rect = entry.boundingClientRect;
        setVisible(rect.bottom < 0);
      },
      { threshold: [0, 1] },
    );
    io.observe(target);
    return () => io.disconnect();
  }, [sentinelId]);

  const handleAdd = () => {
    useCart.getState().add(hero.id);
    useCart.getState().open();
  };

  const prepaidPrice = hero.retailINR - 100;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="sticky-cta"
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: "spring", stiffness: 400, damping: 32 }}
          className="fixed bottom-0 inset-x-0 z-40 flex justify-center pointer-events-none"
          style={{ paddingBottom: "max(0px, env(safe-area-inset-bottom))" }}
        >
          <div className="pointer-events-auto w-full sm:w-auto sm:max-w-3xl sm:mb-4 sm:rounded-2xl bg-white border-t sm:border border-brand-line shadow-2xl px-4 py-2.5 sm:py-3 sm:px-5 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[10px] font-mono uppercase tracking-widest text-brand-ink-soft truncate">
                {hero.name}
              </div>
              <div className="text-lg font-bold text-brand-ink leading-tight flex items-baseline gap-1.5">
                <span>{formatINR(prepaidPrice)}</span>
                <span className="text-xs text-brand-ink-soft line-through font-normal">
                  {formatINR(hero.retailINR)}
                </span>
                <span className="hidden sm:inline text-[10px] font-mono uppercase tracking-widest text-success ml-1">
                  prepaid
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={handleAdd}
              className="bg-brand-red hover:bg-brand-red-hover text-white px-5 py-3 rounded-full font-semibold text-sm inline-flex items-center gap-2 shrink-0 min-h-[44px]"
            >
              <ShoppingBag size={16} />
              Buy now
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
