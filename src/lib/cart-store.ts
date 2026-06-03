"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { PRODUCTS, type Sku } from "./products";
import { OFFERS } from "./config";

export type CartItem = {
  skuId: string;
  /** Selected color variant slug, e.g. "blue". null for SKUs without colors. */
  variantSlug: string | null;
  qty: number;
};

type CartState = {
  items: CartItem[];
  isOpen: boolean;
  /** True once zustand has rehydrated from localStorage on the client. Stays
   *  false during SSR + first client render so cart-derived UI (badge, count,
   *  empty-cart redirect) doesn't flash or mismatch before the saved cart loads. */
  hasHydrated: boolean;
  setHasHydrated: (v: boolean) => void;
  add: (skuId: string, variantSlug: string | null, qty?: number) => void;
  remove: (skuId: string, variantSlug: string | null) => void;
  setQty: (skuId: string, variantSlug: string | null, qty: number) => void;
  clear: () => void;
  open: () => void;
  close: () => void;
  toggle: () => void;
};

function sameLine(a: CartItem, skuId: string, variantSlug: string | null): boolean {
  return a.skuId === skuId && (a.variantSlug ?? null) === (variantSlug ?? null);
}

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      isOpen: false,
      hasHydrated: false,
      setHasHydrated: (v) => set({ hasHydrated: v }),
      add: (skuId, variantSlug, qty = 1) =>
        set((s) => {
          const existing = s.items.find((i) => sameLine(i, skuId, variantSlug));
          if (existing) {
            return {
              items: s.items.map((i) =>
                sameLine(i, skuId, variantSlug) ? { ...i, qty: i.qty + qty } : i,
              ),
              isOpen: true,
            };
          }
          return {
            items: [...s.items, { skuId, variantSlug, qty }],
            isOpen: true,
          };
        }),
      remove: (skuId, variantSlug) =>
        set((s) => ({
          items: s.items.filter((i) => !sameLine(i, skuId, variantSlug)),
        })),
      setQty: (skuId, variantSlug, qty) =>
        set((s) => ({
          items:
            qty <= 0
              ? s.items.filter((i) => !sameLine(i, skuId, variantSlug))
              : s.items.map((i) =>
                  sameLine(i, skuId, variantSlug) ? { ...i, qty } : i,
                ),
        })),
      clear: () => set({ items: [] }),
      open: () => set({ isOpen: true }),
      close: () => set({ isOpen: false }),
      toggle: () => set((s) => ({ isOpen: !s.isOpen })),
    }),
    {
      // v2: variantSlug added. Older v1 carts are discarded by migrate().
      name: "prc-cart",
      version: 2,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ items: s.items }),
      migrate: (_state, fromVersion) => {
        if (fromVersion < 2) {
          return { items: [], isOpen: false } as Partial<CartState>;
        }
        return _state as Partial<CartState>;
      },
      // Fires after rehydration (even when there's nothing stored) — flip the
      // flag so the UI knows the real cart is now loaded.
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    },
  ),
);

export type CartLine = {
  sku: Sku;
  variantSlug: string | null;
  variantName: string | null;
  variantImage: string | null;
  qty: number;
  unitPriceINR: number;
  lineTotalINR: number;
};

export function getCartLines(items: CartItem[]): CartLine[] {
  return items
    .map((i) => {
      const sku = PRODUCTS.find((p) => p.id === i.skuId);
      if (!sku) return null;
      const variant = i.variantSlug
        ? sku.colors?.find((c) => c.slug === i.variantSlug) ?? null
        : null;
      const unitPriceINR = sku.retailINR;
      return {
        sku,
        variantSlug: i.variantSlug,
        variantName: variant?.name ?? null,
        variantImage: variant?.image ?? null,
        qty: i.qty,
        unitPriceINR,
        lineTotalINR: unitPriceINR * i.qty,
      };
    })
    .filter((l): l is CartLine => l !== null);
}

export function getCartSubtotal(items: CartItem[]): number {
  return getCartLines(items).reduce((sum, l) => sum + l.lineTotalINR, 0);
}

export function getCartCount(items: CartItem[]): number {
  return items.reduce((n, i) => n + i.qty, 0);
}

export function getFreeShippingDelta(subtotal: number): number {
  return Math.max(0, OFFERS.freeShippingMinINR - subtotal);
}
