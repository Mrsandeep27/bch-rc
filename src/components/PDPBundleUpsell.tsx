"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Check, Plus } from "lucide-react";
import type { Sku } from "@/lib/products";
import { defaultVariantSlug, getVisibleProducts } from "@/lib/products";
import { formatINR, cn } from "@/lib/utils";
import { useCart } from "@/lib/cart-store";
import { THEME } from "@/lib/theme";

/**
 * "Pair it" bundle module — sits below the Buy Now button on the PDP. Shows
 * the current SKU + a recommended pair-with car, with a single-tap "Add both
 * for ₹2,299 (save ₹299)" CTA. AOV-lifting upsell at the decision moment.
 *
 * Recommended pair = the first visible SKU that isn't the current one. Hero
 * (Pocket Porsche) is pinned first in the products list so most PDPs pair
 * with the Porsche by default; the Porsche pairs with BMW.
 */
export default function PDPBundleUpsell({ sku }: { sku: Sku }) {
  const router = useRouter();
  const visible = getVisibleProducts();
  const pair =
    visible.find((p) => p.id !== sku.id && p.id === "pocket-porsche") ??
    visible.find((p) => p.id !== sku.id);

  const [includePair, setIncludePair] = useState(true);

  if (!pair) return null;

  const singleTotal = sku.retailINR;
  const pairTotal = THEME.bundle2PriceINR;
  const pairSavings = sku.retailINR + pair.retailINR - pairTotal;
  const finalTotal = includePair ? pairTotal : singleTotal;

  function addBundle() {
    const cart = useCart.getState();
    cart.add(sku.id, defaultVariantSlug(sku), 1);
    if (includePair) cart.add(pair!.id, defaultVariantSlug(pair!), 1);
    router.push("/checkout");
  }

  return (
    <div className="mt-6 border-2 border-brand-red/20 rounded-xl overflow-hidden bg-brand-red/5">
      <div className="px-4 py-3 bg-brand-red text-white flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono font-bold uppercase tracking-widest bg-white text-brand-red px-2 py-0.5 rounded-full">
            Best Deal
          </span>
          <span className="text-sm font-bold">
            Pair it · save {formatINR(pairSavings)}
          </span>
        </div>
        <span className="text-xs font-mono uppercase tracking-widest opacity-90">
          1 + 1
        </span>
      </div>

      <div className="p-4 space-y-3">
        {/* This SKU row */}
        <div className="flex items-center gap-3">
          <div className="relative w-14 h-14 shrink-0 rounded-lg overflow-hidden bg-white border border-brand-line">
            <Image
              src={sku.heroImage}
              alt={sku.name}
              fill
              sizes="56px"
              className="object-contain"
            />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-brand-ink truncate">
              {sku.name}
            </p>
            <p className="text-xs text-brand-ink-soft">{formatINR(sku.retailINR)}</p>
          </div>
          <Check size={18} className="text-success shrink-0" />
        </div>

        {/* Plus divider */}
        <div className="flex items-center gap-2">
          <div className="flex-1 h-px bg-brand-line" />
          <Plus size={14} className="text-brand-ink-soft" />
          <div className="flex-1 h-px bg-brand-line" />
        </div>

        {/* Pair-with SKU row — toggleable */}
        <button
          type="button"
          onClick={() => setIncludePair((v) => !v)}
          className={cn(
            "w-full flex items-center gap-3 p-2 rounded-lg border-2 transition-colors text-left",
            includePair
              ? "border-brand-red bg-white"
              : "border-brand-line bg-white/50"
          )}
        >
          <div className="relative w-14 h-14 shrink-0 rounded-lg overflow-hidden bg-white border border-brand-line">
            <Image
              src={pair.heroImage}
              alt={pair.name}
              fill
              sizes="56px"
              className="object-contain"
            />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-brand-ink truncate">
              {pair.name}
            </p>
            <p className="text-xs text-brand-ink-soft">
              <span className="line-through">{formatINR(pair.retailINR)}</span>
              <span className="ml-2 text-brand-red font-semibold">
                FREE bundle pricing
              </span>
            </p>
          </div>
          <div
            className={cn(
              "w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors",
              includePair
                ? "bg-brand-red border-brand-red text-white"
                : "border-brand-line"
            )}
          >
            {includePair && <Check size={12} strokeWidth={3} />}
          </div>
        </button>

        {/* Total + CTA */}
        <div className="pt-1 flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-mono uppercase tracking-widest text-brand-ink-soft">
              Bundle price
            </p>
            <p className="text-xl font-bold text-brand-ink leading-none">
              {formatINR(finalTotal)}
              {includePair && (
                <span className="ml-2 text-xs font-mono text-success">
                  −{formatINR(pairSavings)}
                </span>
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={addBundle}
            className="bg-brand-ink hover:bg-black text-white px-5 py-3 rounded-xl font-bold text-sm transition-colors"
          >
            {includePair ? "Buy bundle" : "Buy single"} →
          </button>
        </div>
      </div>
    </div>
  );
}
