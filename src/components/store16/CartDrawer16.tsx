"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { X, Trash2, Minus, Plus, ShoppingBag } from "lucide-react";
import {
  useCart16,
  getCartLines,
  getCartSubtotal,
  getCartCount,
} from "@/lib/cart-store";
import { formatINR } from "@/lib/utils";

/**
 * 1:16 cart drawer — same chrome as the 1:64 <CartDrawer>, but bound to the
 * isolated useCart16 store and routing to /checkout?store=16 (the shared
 * checkout, driven by the 16 cart). Mounted once in the /16 layout.
 */
export default function CartDrawer16() {
  const items = useCart16((s) => s.items);
  const isOpen = useCart16((s) => s.isOpen);
  const close = useCart16((s) => s.close);
  const setQty = useCart16((s) => s.setQty);
  const remove = useCart16((s) => s.remove);

  const lines = getCartLines(items);
  const subtotal = getCartSubtotal(items);
  const count = getCartCount(items);

  // Escape closes; scroll-lock while open.
  const panelRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [isOpen, close]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            key="cart16-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={close}
            className="fixed inset-0 bg-black/50 z-50"
            aria-hidden="true"
          />
          <motion.aside
            key="cart16-panel"
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label="Cart"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 36 }}
            className="fixed right-0 top-0 h-full w-full sm:w-[28rem] bg-white z-50 shadow-2xl flex flex-col"
          >
            <header className="flex items-center justify-between px-5 py-4 border-b border-brand-line">
              <h2 className="text-lg font-bold text-brand-ink">
                Your cart ({count})
              </h2>
              <button
                type="button"
                onClick={close}
                aria-label="Close cart"
                className="h-11 w-11 flex items-center justify-center text-brand-ink-soft hover:text-brand-ink"
              >
                <X size={22} />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto px-5">
              {count === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center gap-4 py-10">
                  <ShoppingBag size={48} className="text-brand-ink-soft" />
                  <p className="text-brand-ink-soft text-sm">
                    Cart is empty. Pick a drift car below.
                  </p>
                  <button
                    type="button"
                    onClick={close}
                    className="px-5 py-2.5 rounded-full bg-brand-red hover:bg-brand-red-hover text-white text-sm font-semibold"
                  >
                    Browse
                  </button>
                </div>
              ) : (
                <ul className="divide-y divide-brand-line">
                  {lines.map((line) => (
                    <li
                      key={`${line.sku.id}-${line.variantSlug ?? "default"}`}
                      className="flex gap-3 py-3.5"
                    >
                      <div className="w-16 h-16 rounded-lg bg-brand-cream relative overflow-hidden flex-shrink-0">
                        <Image
                          src={line.variantImage ?? line.sku.heroImage}
                          alt={line.sku.name}
                          fill
                          sizes="64px"
                          className="object-cover"
                        />
                      </div>
                      <div className="flex-1 min-w-0 flex flex-col justify-between">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="font-semibold text-brand-ink text-sm leading-tight truncate">
                              {line.sku.name}
                            </div>
                            <div className="text-[11px] text-brand-ink-soft mt-0.5">
                              {line.sku.scale}
                            </div>
                          </div>
                          <div className="font-bold text-brand-ink text-sm tabular-nums whitespace-nowrap">
                            {formatINR(line.lineTotalINR)}
                          </div>
                        </div>
                        <div className="flex items-center justify-between gap-2 mt-2">
                          <div className="inline-flex items-center border border-brand-line rounded-full overflow-hidden bg-white">
                            <button
                              type="button"
                              onClick={() =>
                                setQty(line.sku.id, line.variantSlug, line.qty - 1)
                              }
                              aria-label="Decrease quantity"
                              className="h-8 w-8 flex items-center justify-center text-brand-ink-soft hover:bg-brand-cream"
                            >
                              <Minus size={13} />
                            </button>
                            <span className="px-2.5 text-[13px] font-semibold tabular-nums text-brand-ink min-w-[28px] text-center">
                              {line.qty}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                setQty(line.sku.id, line.variantSlug, line.qty + 1)
                              }
                              aria-label="Increase quantity"
                              className="h-8 w-8 flex items-center justify-center text-brand-ink-soft hover:bg-brand-cream"
                            >
                              <Plus size={13} />
                            </button>
                          </div>
                          <button
                            type="button"
                            onClick={() => remove(line.sku.id, line.variantSlug)}
                            aria-label={`Remove ${line.sku.name}`}
                            className="h-8 w-8 flex items-center justify-center text-brand-ink-soft hover:text-brand-red rounded-full hover:bg-brand-red-soft"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {count > 0 && (
              <div className="border-t border-brand-line p-5 space-y-2.5">
                <div className="flex justify-between text-brand-ink font-bold">
                  <span>Subtotal</span>
                  <span className="tabular-nums">{formatINR(subtotal)}</span>
                </div>
                <p className="text-[11px] text-brand-ink-soft -mt-1">
                  Shipping &amp; taxes calculated at checkout
                </p>
                <Link
                  href="/checkout?store=16"
                  onClick={close}
                  className="bg-brand-red hover:bg-brand-red-hover text-white py-3.5 rounded-xl font-semibold flex items-center justify-center gap-2"
                >
                  Checkout · {formatINR(subtotal)}
                </Link>
              </div>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
