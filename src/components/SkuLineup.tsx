"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ShoppingBag, Star, ShieldCheck } from "lucide-react";
import { getVisibleProducts, type Sku, type ColorVariant } from "@/lib/products";
import { formatINR, calcDiscountPct, cn } from "@/lib/utils";
import { useCart } from "@/lib/cart-store";
import { ProductImage } from "@/components/ProductImage";
import { THEME } from "@/lib/theme";
import { trackAddToCart } from "@/lib/analytics-client";

/** Resolve a swatch token (hex or `gradient:from,to[,...]`) to a CSS background value. */
function swatchBg(swatch: string): string {
  if (swatch.startsWith("gradient:")) {
    const stops = swatch.slice("gradient:".length);
    return `linear-gradient(135deg, ${stops})`;
  }
  return swatch;
}

function SwatchRow({ colors, max = 5 }: { colors: ColorVariant[]; max?: number }) {
  const shown = colors.slice(0, max);
  const extra = colors.length - shown.length;
  return (
    <div className="flex items-center gap-1.5">
      {shown.map((c) => (
        <span
          key={c.slug}
          title={c.name}
          aria-label={c.name}
          className="w-3.5 h-3.5 rounded-full border border-brand-line shadow-sm"
          style={{ background: swatchBg(c.swatch) }}
        />
      ))}
      {extra > 0 && (
        <span className="text-[10px] font-mono text-brand-ink-soft">+{extra}</span>
      )}
    </div>
  );
}

// One-line "pick reason" per SKU index — small caps badge above SKU name.
// Mirrors Legend of Toys "Best for drifting / Parents' choice / Collector's pick".
const PICK_REASONS = [
  "Beginner friendly",
  "Most gifted",
  "Made for India",
  "Pro 4WD",
  "Best value",
  "Collector's pick",
  "Family friendly",
  "Premium gift",
] as const;

type SkuCardProps = {
  sku: Sku;
  index: number;
  stockMap: Record<string, number> | null;
};

function SkuCard({ sku, index, stockMap }: SkuCardProps) {
  const isHero = sku.badge === "MOST GIFTED";
  const pct = calcDiscountPct(sku.mrpINR, sku.retailINR);
  const pickReason = PICK_REASONS[index] ?? "Editor's pick";

  // DB inventory is the source of truth. Keys: `${sku.id}:${variantSlug}`
  // ("" for colourless SKUs). Optimistic (available) until the map loads.
  const variantKeys = sku.colors?.length
    ? sku.colors.map((c) => `${sku.id}:${c.slug}`)
    : [`${sku.id}:`];
  const skuSoldOut =
    stockMap !== null && variantKeys.every((k) => (stockMap[k] ?? 0) <= 0);
  const firstInStockSlug =
    sku.colors?.find((c) => (stockMap?.[`${sku.id}:${c.slug}`] ?? 1) > 0)?.slug ??
    sku.colors?.[0]?.slug ??
    null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4, delay: index * 0.1, ease: "easeOut" }}
      className={cn(
        "snap-center min-w-[85%] sm:min-w-0 bg-white border rounded-2xl overflow-hidden flex flex-col shadow-md relative group",
        isHero
          ? "border-brand-red ring-2 ring-brand-red"
          : "border-brand-line"
      )}
    >
      {/* Whole-card click target → PDP. Sits behind the body but covers the
          entire card; the Add-to-cart button is raised above this layer with
          z-10 so it intercepts taps and never navigates. Accessibility: this
          link is what the screen reader reads, named after the SKU. */}
      <Link
        href={`/product/${sku.slug}`}
        aria-label={`View ${sku.name} details`}
        className="absolute inset-0 z-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-red rounded-2xl"
      />

      <div className="aspect-square relative flex items-center justify-center overflow-hidden">
        <ProductImage sku={sku} />
        {sku.badge && (
          <span
            className={cn(
              "absolute top-3 left-3 bg-brand-red text-white text-[10px] sm:text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-full z-10 shadow-md",
              isHero && "flex items-center gap-1"
            )}
          >
            {isHero && <Star size={12} className="fill-white" />}
            {sku.badge}
          </span>
        )}

        {/* Diagonal corner ribbon — top-right, clean cut design */}
        {pct >= 5 && (
          <div
            aria-label={`${pct} percent off`}
            className="absolute top-0 right-0 z-10 w-[88px] h-[88px] overflow-hidden pointer-events-none select-none"
          >
            <div className="absolute top-[18px] -right-[26px] w-[120px] bg-brand-red text-white text-center py-1 shadow-lg font-display font-bold text-sm sm:text-base tracking-tight rotate-45">
              {pct}% OFF
            </div>
          </div>
        )}
      </div>

      {/* Minimal card body — name + price + Add. Tagline + bullets live on
          PDP only. The body sits ABOVE the whole-card link overlay so the
          Add-to-cart button works on its own without bubbling to the PDP. */}
      <div className="p-4 sm:p-5 flex flex-col gap-3 relative z-10 pointer-events-none">
        <div className="flex items-center justify-between gap-2 -mb-1">
          <span className="text-[10px] font-mono text-brand-ink-soft uppercase tracking-widest">
            {sku.scale}
          </span>
          <span className="text-[10px] font-mono uppercase tracking-widest text-brand-red font-semibold truncate">
            {pickReason}
          </span>
        </div>

        <span className="text-lg sm:text-xl font-bold text-brand-ink group-hover:text-brand-red transition-colors leading-tight">
          {sku.name}
        </span>

        {sku.colors && sku.colors.length > 0 && (
          <SwatchRow colors={sku.colors} />
        )}

        <div className="-mt-1">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-xl sm:text-2xl font-bold text-brand-ink">
              {formatINR(sku.retailINR)}
            </span>
            <span className="text-xs text-brand-ink-soft line-through">
              {formatINR(sku.mrpINR)}
            </span>
            <span className="text-[10px] font-mono uppercase tracking-widest text-brand-red font-semibold">
              {calcDiscountPct(sku.mrpINR, sku.retailINR)}% off
            </span>
          </div>
          <div className="text-[11px] font-mono text-success mt-1">
            {formatINR(sku.retailINR - THEME.prepaidDiscountINR)} online · ₹
            {THEME.prepaidDiscountINR} bonus
          </div>
        </div>

        {/* Re-enable pointer events on this button so it intercepts clicks
            and never propagates to the card-wide PDP link. */}
        <button
          type="button"
          disabled={skuSoldOut}
          onClick={(e) => {
            e.stopPropagation();
            if (skuSoldOut) return;
            // Default to the first DB-in-stock colour. PDP picker can override.
            useCart.getState().add(sku.id, firstInStockSlug);
            trackAddToCart({
              sku: sku.id,
              name: sku.name,
              priceInr: sku.retailINR,
              quantity: 1,
            });
          }}
          className="pointer-events-auto bg-brand-red hover:bg-brand-red-hover text-white rounded-full py-2.5 px-4 transition-colors inline-flex items-center justify-center gap-2 font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-brand-red"
        >
          <ShoppingBag size={16} aria-hidden />
          {skuSoldOut ? "Sold out" : "Add to cart"}
        </button>

        <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest text-brand-ink-soft -mt-1">
          <ShieldCheck size={12} className="text-success" aria-hidden />
          7-day replacement · WhatsApp support
        </div>
      </div>
    </motion.div>
  );
}

export default function SkuLineup() {
  // Live DB stock for the whole grid — single source of truth, fetched once.
  const [stockMap, setStockMap] = useState<Record<string, number> | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/stock")
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled && d && typeof d.stock === "object") setStockMap(d.stock);
      })
      .catch(() => {
        /* leave optimistic on failure */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section id="sku" className="py-8 sm:py-14 bg-white">
      <div className="max-w-6xl mx-auto px-4">
        <h2 className="text-3xl sm:text-4xl font-bold text-brand-ink text-center text-balance">
          Pick your RC car.
        </h2>
        <p className="text-brand-ink-soft text-center mt-2 text-base sm:text-lg">
          5 die-cast 1:64 RC cars built for drift · from ₹999 online · ships in
          24&nbsp;hrs from Bangalore.
        </p>
      </div>

      <div className="max-w-7xl mx-auto px-4 mt-6 sm:mt-10">
        <div className="flex overflow-x-auto overflow-y-hidden snap-x snap-mandatory gap-4 no-scrollbar -mx-4 px-4 pb-4 sm:grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 sm:gap-5 lg:gap-6 sm:overflow-visible sm:min-w-0 sm:mx-0 sm:px-0 sm:pb-0">
          {getVisibleProducts().map((sku, i) => (
            <SkuCard key={sku.id} sku={sku} index={i} stockMap={stockMap} />
          ))}
        </div>

        {/* "More coming soon" — sits below the grid, intentionally subtle */}
        <div className="mt-5 sm:mt-8 flex justify-center">
          <span className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-brand-ink text-white text-xs sm:text-sm font-mono font-semibold uppercase tracking-widest">
            <span className="w-2 h-2 rounded-full bg-brand-red animate-pulse" />
            More drift cars dropping soon · stay tuned
          </span>
        </div>
      </div>
    </section>
  );
}
