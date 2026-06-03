"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { X, Trash2, Minus, Plus, ShoppingBag } from "lucide-react";
import {
  useCart,
  getCartLines,
  getCartSubtotal,
  getCartCount,
  getFreeShippingDelta,
} from "@/lib/cart-store";
import { OFFERS, waLink } from "@/lib/config";
import { formatINR } from "@/lib/utils";

export default function CartDrawer({
  initialOpen = false,
}: { initialOpen?: boolean }) {
  const items = useCart((s) => s.items);
  const isOpen = useCart((s) => s.isOpen);
  const close = useCart((s) => s.close);
  const open = useCart((s) => s.open);
  const setQty = useCart((s) => s.setQty);
  const remove = useCart((s) => s.remove);

  const lines = getCartLines(items);
  const subtotal = getCartSubtotal(items);
  const count = getCartCount(items);
  const delta = getFreeShippingDelta(subtotal);
  const progressPct = Math.min(
    100,
    (subtotal / OFFERS.freeShippingMinINR) * 100,
  );

  const waMessage =
    "Hi, I want to order:\n" +
    lines
      .map(
        (l) =>
          `- ${l.qty}× ${l.sku.name}${l.variantName ? ` (${l.variantName})` : ""} (${l.sku.scale}) — ${formatINR(
            l.lineTotalINR,
          )}`,
      )
      .join("\n");

  // Open from ?openCart=1 query param on first mount.
  const initialOpenAppliedRef = useRef(false);
  useEffect(() => {
    if (initialOpen && !initialOpenAppliedRef.current) {
      initialOpenAppliedRef.current = true;
      open();
    }
  }, [initialOpen, open]);

  // Escape closes the drawer.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, close]);

  // Focus trap + scroll lock while open.
  const panelRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!isOpen) return;
    const prevOverflow = document.body.style.overflow;
    const prevFocused = document.activeElement as HTMLElement | null;
    document.body.style.overflow = "hidden";

    const focusFirst = () => {
      const focusables = panelRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"]), input, select, textarea',
      );
      focusables?.[0]?.focus();
    };
    const t = setTimeout(focusFirst, 50);

    const onTab = (e: KeyboardEvent) => {
      if (e.key !== "Tab" || !panelRef.current) return;
      const focusables = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"]), input, select, textarea',
        ),
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onTab);

    return () => {
      clearTimeout(t);
      window.removeEventListener("keydown", onTab);
      document.body.style.overflow = prevOverflow;
      prevFocused?.focus?.();
    };
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            key="cart-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={close}
            className="fixed inset-0 bg-black/50 z-50"
            aria-hidden="true"
          />
          <motion.aside
            key="cart-panel"
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

            {count > 0 && (
              <div
                className={
                  delta > 0
                    ? "mx-5 my-3 p-3 rounded-lg bg-brand-red-soft text-brand-red text-sm font-medium"
                    : "mx-5 my-3 p-3 rounded-lg bg-success/10 text-success text-sm font-medium"
                }
              >
                {delta > 0 ? (
                  <>
                    <div>Add {formatINR(delta)} more for FREE shipping</div>
                    <div className="h-1 bg-white/60 rounded-full mt-2 overflow-hidden">
                      <div
                        className="h-full bg-brand-red"
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                  </>
                ) : (
                  <>🎉 Free shipping unlocked!</>
                )}
              </div>
            )}

            <div className="flex-1 overflow-y-auto px-5">
              {count === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center gap-4 py-10">
                  <ShoppingBag size={48} className="text-brand-ink-soft" />
                  <p className="text-brand-ink-soft text-sm">
                    Cart is empty. Pick a car below.
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
                <ul>
                  {lines.map((line) => (
                    <li
                      key={`${line.sku.id}-${line.variantSlug ?? "default"}`}
                      className="flex gap-4 py-4 border-b border-brand-line last:border-b-0"
                    >
                      <div className="w-20 h-20 rounded-lg bg-brand-cream relative overflow-hidden flex-shrink-0">
                        <Image
                          src={line.variantImage ?? line.sku.heroImage}
                          alt={
                            line.sku.name +
                            (line.variantName ? ` (${line.variantName})` : "")
                          }
                          fill
                          sizes="80px"
                          className="object-contain p-2"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-brand-ink">
                          {line.sku.name}
                        </div>
                        <div className="text-xs text-brand-ink-soft">
                          {line.sku.scale}
                          {line.variantName ? ` · ${line.variantName}` : ""}
                        </div>
                        <div className="mt-1 text-sm text-brand-ink">
                          {formatINR(line.unitPriceINR)}
                        </div>
                        <div className="flex items-center gap-1 mt-2 border border-brand-line rounded-lg w-fit">
                          <button
                            type="button"
                            onClick={() =>
                              setQty(line.sku.id, line.variantSlug, line.qty - 1)
                            }
                            aria-label="Decrease quantity"
                            className="h-11 w-11 flex items-center justify-center text-brand-ink-soft hover:text-brand-ink"
                          >
                            <Minus size={14} />
                          </button>
                          <span className="px-3 text-sm tabular-nums">{line.qty}</span>
                          <button
                            type="button"
                            onClick={() =>
                              setQty(line.sku.id, line.variantSlug, line.qty + 1)
                            }
                            aria-label="Increase quantity"
                            className="h-11 w-11 flex items-center justify-center text-brand-ink-soft hover:text-brand-ink"
                          >
                            <Plus size={14} />
                          </button>
                        </div>
                      </div>
                      <div className="flex flex-col items-end justify-between">
                        <div className="font-semibold text-brand-ink whitespace-nowrap">
                          {formatINR(line.lineTotalINR)}
                        </div>
                        <button
                          type="button"
                          onClick={() => remove(line.sku.id, line.variantSlug)}
                          aria-label={`Remove ${line.sku.name}`}
                          className="h-11 w-11 flex items-center justify-center text-brand-ink-soft hover:text-brand-red"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {count > 0 && (
              <div className="border-t border-brand-line p-5 space-y-3">
                <div className="flex justify-between text-brand-ink">
                  <span>Subtotal</span>
                  <span className="font-semibold">{formatINR(subtotal)}</span>
                </div>
                <p className="text-xs text-brand-ink-soft">
                  Shipping & taxes calculated at checkout
                </p>
                <Link
                  href="/checkout"
                  onClick={close}
                  aria-disabled={subtotal === 0}
                  className={
                    subtotal === 0
                      ? "bg-brand-red/50 text-white py-3.5 rounded-xl font-semibold flex items-center justify-center gap-2 pointer-events-none"
                      : "bg-brand-red hover:bg-brand-red-hover text-white py-3.5 rounded-xl font-semibold flex items-center justify-center gap-2"
                  }
                >
                  Checkout · {formatINR(subtotal)}
                </Link>
                <a
                  href={waLink(waMessage)}
                  target="_blank"
                  rel="noopener"
                  className="block text-center py-3 rounded-xl border border-brand-line text-brand-ink hover:bg-brand-cream font-medium text-sm"
                >
                  or order on WhatsApp →
                </a>
              </div>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
