"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { PRODUCTS, type Sku } from "./products";
import { OFFERS } from "./config";

export type CartItem = {
  skuId: string;
  qty: number;
};

type CartState = {
  items: CartItem[];
  isOpen: boolean;
  add: (skuId: string, qty?: number) => void;
  remove: (skuId: string) => void;
  setQty: (skuId: string, qty: number) => void;
  clear: () => void;
  open: () => void;
  close: () => void;
  toggle: () => void;
};

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      isOpen: false,
      add: (skuId, qty = 1) =>
        set((s) => {
          const existing = s.items.find((i) => i.skuId === skuId);
          if (existing) {
            return {
              items: s.items.map((i) =>
                i.skuId === skuId ? { ...i, qty: i.qty + qty } : i
              ),
              isOpen: true,
            };
          }
          return { items: [...s.items, { skuId, qty }], isOpen: true };
        }),
      remove: (skuId) =>
        set((s) => ({ items: s.items.filter((i) => i.skuId !== skuId) })),
      setQty: (skuId, qty) =>
        set((s) => ({
          items:
            qty <= 0
              ? s.items.filter((i) => i.skuId !== skuId)
              : s.items.map((i) => (i.skuId === skuId ? { ...i, qty } : i)),
        })),
      clear: () => set({ items: [] }),
      open: () => set({ isOpen: true }),
      close: () => set({ isOpen: false }),
      toggle: () => set((s) => ({ isOpen: !s.isOpen })),
    }),
    {
      name: "bch-rc-cart",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ items: s.items }),
    }
  )
);

export type CartLine = {
  sku: Sku;
  qty: number;
  lineTotalINR: number;
};

export function getCartLines(items: CartItem[]): CartLine[] {
  return items
    .map((i) => {
      const sku = PRODUCTS.find((p) => p.id === i.skuId);
      if (!sku) return null;
      return { sku, qty: i.qty, lineTotalINR: sku.retailINR * i.qty };
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
