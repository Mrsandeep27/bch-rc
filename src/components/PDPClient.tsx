"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Minus, Plus, ShoppingBag, Zap, Truck, Shield, RotateCw } from "lucide-react";
import type { Sku } from "@/lib/products";
import { formatINR, calcDiscountPct, cn } from "@/lib/utils";

// SKUs without color variants don't track per-unit stock — cap them at a sane
// per-order quantity so the stepper still has an upper bound.
const NO_VARIANT_MAX_QTY = 10;
// Threshold under which we surface a "Only N left" scarcity nudge.
const LOW_STOCK_THRESHOLD = 5;
import { useCart } from "@/lib/cart-store";
import { ProductPlaceholder } from "@/components/ProductPlaceholder";
import PDPStickyCTA from "@/components/PDPStickyCTA";
import { Skeleton } from "@/components/Skeleton";
import { recordView } from "@/lib/recently-viewed";

// Below-fold sections — split into their own JS chunks so the buy-box +
// gallery don't wait on their bundle. Skeletons hold the layout so scrolling
// down doesn't jolt the page when the chunk arrives.
const PDPBundleUpsell = dynamic(() => import("@/components/PDPBundleUpsell"), {
  loading: () => <Skeleton className="h-72 w-full my-8" />,
});
const ReviewsBlock = dynamic(() => import("@/components/ReviewsBlock"), {
  loading: () => <Skeleton className="h-96 w-full my-8" />,
});
const RecentlyViewed = dynamic(() => import("@/components/RecentlyViewed"), {
  loading: () => <Skeleton className="h-72 w-full my-8" />,
  ssr: false,
});

function swatchBg(swatch: string): string {
  if (swatch.startsWith("gradient:")) {
    return `linear-gradient(135deg, ${swatch.slice("gradient:".length)})`;
  }
  return swatch;
}

/**
 * Gallery image with graceful fallback — uses next/image and degrades to the
 * colored SVG placeholder if the file 404s. Lets us list altImages that don't
 * exist yet without breaking the page.
 */
function GalleryImage({
  src,
  sku,
  alt,
  priority,
}: {
  src: string;
  sku: Sku;
  alt: string;
  priority?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  if (failed) return <ProductPlaceholder sku={sku} showLabel={false} />;
  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes="(min-width: 1024px) 600px, 100vw"
      className="object-contain object-center"
      priority={priority}
      onError={() => setFailed(true)}
    />
  );
}

export default function PDPClient({ sku }: { sku: Sku }) {
  const router = useRouter();
  const [qty, setQty] = useState(1);
  const [activeImage, setActiveImage] = useState(0);
  const [selectedColorSlug, setSelectedColorSlug] = useState<string | null>(
    sku.colors?.[0]?.slug ?? null
  );

  // DB inventory is the single source of truth for stock. Fetch the live map
  // for this SKU on mount; until it loads we stay optimistic (the order-create
  // endpoint is the hard gate, so an optimistic add can never oversell).
  const [stockMap, setStockMap] = useState<Record<string, number> | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/stock?skuIds=${encodeURIComponent(sku.id)}`)
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled && d && typeof d.stock === "object") setStockMap(d.stock);
      })
      .catch(() => {
        /* leave stock optimistic on failure */
      });
    return () => {
      cancelled = true;
    };
  }, [sku.id]);

  const stockLoaded = stockMap !== null;
  // null while loading (treat as available); a number once loaded (0 = sold out).
  const stockOf = (slug: string | null): number | null =>
    stockMap ? stockMap[`${sku.id}:${slug ?? ""}`] ?? 0 : null;

  // Once live stock loads, if the pre-selected colour is sold out, jump to the
  // first in-stock colour so the buyer never lands on an unavailable variant.
  useEffect(() => {
    if (!stockMap || !sku.colors?.length) return;
    if ((stockMap[`${sku.id}:${selectedColorSlug ?? ""}`] ?? 0) > 0) return;
    const firstIn = sku.colors.find(
      (c) => (stockMap[`${sku.id}:${c.slug}`] ?? 0) > 0,
    );
    if (firstIn) {
      setSelectedColorSlug(firstIn.slug);
      setActiveImage(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stockMap]);

  const selectedColor =
    sku.colors?.find((c) => c.slug === selectedColorSlug) ?? null;
  const hasColors = !!sku.colors?.length;
  const selectedStock = stockOf(selectedColorSlug);
  // Sold out only once live stock has loaded and confirms zero. Colour-less
  // SKUs stay purchasable (the server caps qty).
  const outOfStock = hasColors ? stockLoaded && (selectedStock ?? 0) <= 0 : false;
  // Qty cap: real DB stock once loaded; an optimistic cap while loading.
  const LOADING_MAX = 10;
  const maxQty = hasColors
    ? stockLoaded
      ? Math.max(1, selectedStock ?? 0)
      : LOADING_MAX
    : NO_VARIANT_MAX_QTY;
  const savings = sku.mrpINR - sku.retailINR;
  const pct = calcDiscountPct(sku.mrpINR, sku.retailINR);
  // Gallery: color-specific hero plus per-color alt angles when the
  // selected swatch defines them. Falls back to sku.altImages (shared
  // across colors) only for color-less SKUs — the legacy shared alts
  // were AI-generated and don't match the cleaned real-photo color
  // heros, so colored SKUs MUST use per-color alts.
  const heroSrc = selectedColor?.image ?? sku.heroImage;
  const colorAlts = selectedColor?.altImages ?? [];
  const gallery = sku.colors?.length
    ? [heroSrc, ...colorAlts].filter(Boolean)
    : [heroSrc, ...(sku.altImages ?? [])].filter(Boolean);
  const activeSrc = gallery[activeImage] ?? heroSrc;

  function addToCart() {
    if (outOfStock) return;
    // `add` opens the drawer itself.
    useCart.getState().add(sku.id, selectedColorSlug, Math.min(qty, maxQty));
  }

  function buyNow() {
    if (outOfStock) return;
    useCart.getState().add(sku.id, selectedColorSlug, Math.min(qty, maxQty));
    router.push("/checkout");
  }

  // Track this SKU as recently viewed for the "Pick up where you left off"
  // strip — fires once when the PDP mounts.
  useEffect(() => {
    recordView(sku.id);
  }, [sku.id]);

  return (
    <>
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-12 max-w-6xl mx-auto px-4 py-4 sm:py-8">
      {/* Image gallery. On mobile this is just a normal block — no sticky,
          no overflow scroll, no aspect-ratio mismatch. The card is always
          square so the 1:1 source images fill it edge-to-edge with no
          "floating" white margin. */}
      <div className="space-y-3 lg:sticky lg:top-20 lg:self-start lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto no-scrollbar">
        <div className="aspect-square rounded-2xl overflow-hidden border border-brand-line bg-brand-cream relative">
          <GalleryImage src={activeSrc} sku={sku} alt={sku.name} priority />
        </div>
        {gallery.length > 1 && (
          <div className="grid grid-cols-4 gap-2">
            {gallery.slice(0, 4).map((src, i) => (
              <button
                key={src + i}
                type="button"
                onClick={() => setActiveImage(i)}
                className={cn(
                  "aspect-square rounded-lg overflow-hidden border-2 transition-all relative bg-white",
                  activeImage === i
                    ? "border-brand-red"
                    : "border-brand-line hover:border-brand-ink-soft"
                )}
                aria-label={`View image ${i + 1}`}
              >
                <GalleryImage src={src} sku={sku} alt={`${sku.name} view ${i + 1}`} />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Info column */}
      <div>
        {sku.badge && (
          <span className="inline-block bg-brand-red text-white text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full mb-2 sm:mb-3">
            {sku.badge}
          </span>
        )}
        <p className="text-[10px] sm:text-xs font-mono uppercase tracking-widest text-brand-ink-soft">
          {sku.scale} · {sku.bodyShape}
        </p>
        <h1 className="text-2xl sm:text-4xl font-bold text-brand-ink mt-1 leading-tight text-balance">
          {sku.name}
        </h1>
        <p className="text-sm sm:text-lg text-brand-ink-soft mt-1 sm:mt-2">{sku.tagline}</p>

        {/* Color picker — moved above price so it's visible in the mobile fold
            without scrolling. Most buyers decide colour before re-checking price. */}
        {sku.colors && sku.colors.length > 0 && (
          <div className="mt-3 sm:mt-5">
            <div className="flex items-baseline justify-between">
              <span className="text-[10px] sm:text-xs font-mono uppercase tracking-widest text-brand-ink-soft">
                Colour
              </span>
              {selectedColor && (
                <span className="text-xs sm:text-sm font-semibold text-brand-ink">
                  {selectedColor.name}
                  {stockLoaded && (selectedStock ?? 0) <= 0 ? (
                    <span className="text-brand-red font-normal"> · Sold out</span>
                  ) : stockLoaded &&
                    (selectedStock ?? 0) <= LOW_STOCK_THRESHOLD ? (
                    <span className="text-brand-red font-normal">
                      {" "}
                      · Only {selectedStock} left
                    </span>
                  ) : null}
                </span>
              )}
            </div>
            <div
              role="radiogroup"
              aria-label="Choose colour"
              className="mt-2 flex flex-wrap gap-2"
            >
              {sku.colors.map((c) => {
                const active = c.slug === selectedColorSlug;
                const cStock = stockOf(c.slug);
                const soldOut = stockLoaded && (cStock ?? 0) <= 0;
                return (
                  <button
                    key={c.slug}
                    type="button"
                    disabled={soldOut}
                    onClick={() => {
                      setSelectedColorSlug(c.slug);
                      setActiveImage(0);
                      // Clamp the chosen qty to the new colour's live stock.
                      setQty((q) =>
                        cStock != null ? Math.min(q, Math.max(1, cStock)) : q,
                      );
                    }}
                    role="radio"
                    aria-checked={active}
                    aria-label={soldOut ? `${c.name} — sold out` : c.name}
                    aria-disabled={soldOut}
                    title={soldOut ? `${c.name} — sold out` : c.name}
                    className={cn(
                      "w-11 h-11 sm:w-10 sm:h-10 rounded-full border-2 transition-colors relative shrink-0 overflow-hidden",
                      active
                        ? "border-brand-ink ring-2 ring-offset-1 ring-brand-red"
                        : "border-brand-line hover:border-brand-ink-soft active:scale-95",
                      soldOut && "opacity-40 cursor-not-allowed hover:border-brand-line active:scale-100"
                    )}
                    style={{ background: swatchBg(c.swatch) }}
                  >
                    {soldOut && (
                      // Diagonal strike-through so a sold-out swatch reads as
                      // unavailable even on similar colours.
                      <span
                        aria-hidden
                        className="absolute inset-0 block"
                        style={{
                          background:
                            "linear-gradient(to top right, transparent calc(50% - 1px), rgba(120,120,120,0.9) calc(50% - 1px), rgba(120,120,120,0.9) calc(50% + 1px), transparent calc(50% + 1px))",
                        }}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Rating row */}
        <div className="flex items-center gap-1.5 sm:gap-2 mt-3 sm:mt-4 text-xs sm:text-sm">
          <span className="text-gold">★★★★★</span>
          <span className="font-semibold text-brand-ink">4.7</span>
          <span className="text-brand-ink-soft">· 238 verified reviews</span>
        </div>

        {/* Price block */}
        <div className="mt-2 sm:mt-4">
          <div className="flex items-baseline gap-2 sm:gap-3 flex-wrap">
            <span className="text-3xl sm:text-4xl font-bold text-brand-ink">
              {formatINR(sku.retailINR)}
            </span>
            <span className="text-base sm:text-lg text-brand-ink-soft line-through">
              {formatINR(sku.mrpINR)}
            </span>
            <span className="text-xs sm:text-sm font-semibold bg-success/10 text-success px-2 py-0.5 rounded">
              Save {formatINR(savings)} · {pct}% off
            </span>
          </div>
          <p className="text-[11px] sm:text-xs text-brand-ink-soft mt-1 sm:mt-2">
            Inclusive of all taxes · Pay online → save ₹100
          </p>
        </div>

        {/* Bullets */}
        <ul className="mt-4 sm:mt-6 space-y-2">
          {sku.bullets.map((b) => (
            <li key={b} className="flex items-start gap-2 text-sm text-brand-ink">
              <Zap size={16} className="text-brand-red shrink-0 mt-0.5" />
              <span>{b}</span>
            </li>
          ))}
        </ul>

        {/* Qty + CTAs */}
        <div className="mt-4 sm:mt-7 flex items-stretch gap-3">
          <div className="flex items-center border-2 border-brand-line rounded-xl">
            <button
              type="button"
              onClick={() => setQty(Math.max(1, qty - 1))}
              className="w-11 h-11 flex items-center justify-center text-brand-ink-soft hover:text-brand-ink"
              aria-label="Decrease quantity"
            >
              <Minus size={16} />
            </button>
            <span className="w-10 text-center font-semibold text-brand-ink">
              {qty}
            </span>
            <button
              type="button"
              onClick={() => setQty((q) => Math.min(maxQty, q + 1))}
              disabled={qty >= maxQty}
              className="w-11 h-11 flex items-center justify-center text-brand-ink-soft hover:text-brand-ink disabled:opacity-40 disabled:cursor-not-allowed"
              aria-label="Increase quantity"
            >
              <Plus size={16} />
            </button>
          </div>
          <button
            type="button"
            onClick={addToCart}
            disabled={outOfStock}
            className="flex-1 bg-white border-2 border-brand-ink text-brand-ink hover:bg-brand-ink hover:text-white px-5 py-3 rounded-xl font-semibold text-sm transition-colors inline-flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:text-brand-ink"
          >
            <ShoppingBag size={16} />
            Add to Cart
          </button>
        </div>
        <button
          type="button"
          onClick={buyNow}
          disabled={outOfStock}
          className="mt-3 w-full bg-brand-red hover:bg-brand-red-hover text-white py-4 rounded-xl font-bold text-base transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-brand-red"
        >
          {outOfStock ? "Sold out" : `Buy Now · ${formatINR(sku.retailINR * qty)}`}
        </button>

        {/* Bundle upsell at the decision moment — directly below Buy Now */}
        <PDPBundleUpsell sku={sku} />

        {/* Trust row */}
        <div className="mt-6 grid grid-cols-3 gap-3 text-center">
          <div className="p-3 border border-brand-line rounded-lg">
            <Truck size={18} className="mx-auto text-brand-red" />
            <p className="text-[11px] font-semibold text-brand-ink mt-1.5">
              Ships in 24 hrs
            </p>
            <p className="text-[10px] text-brand-ink-soft">from Bangalore</p>
          </div>
          <div className="p-3 border border-brand-line rounded-lg">
            <RotateCw size={18} className="mx-auto text-brand-red" />
            <p className="text-[11px] font-semibold text-brand-ink mt-1.5">
              7-Day Free
            </p>
            <p className="text-[10px] text-brand-ink-soft">Replacement</p>
          </div>
          <div className="p-3 border border-brand-line rounded-lg">
            <Shield size={18} className="mx-auto text-brand-red" />
            <p className="text-[11px] font-semibold text-brand-ink mt-1.5">
              Recommended
            </p>
            <p className="text-[10px] text-brand-ink-soft">Age {sku.specs.minAge}+</p>
          </div>
        </div>

        {/* Specs */}
        <details className="mt-6 border border-brand-line rounded-xl overflow-hidden">
          <summary className="px-5 py-4 font-semibold text-brand-ink cursor-pointer bg-brand-cream">
            Full specs
          </summary>
          <div className="px-5 py-4 text-sm">
            <dl className="grid grid-cols-2 gap-y-2">
              <dt className="text-brand-ink-soft">Scale</dt>
              <dd className="text-brand-ink">{sku.scale}</dd>
              <dt className="text-brand-ink-soft">Length</dt>
              <dd className="text-brand-ink">{sku.specs.lengthMM} mm</dd>
              <dt className="text-brand-ink-soft">Drive</dt>
              <dd className="text-brand-ink">{sku.specs.drive}</dd>
              <dt className="text-brand-ink-soft">Top speed</dt>
              <dd className="text-brand-ink">{sku.specs.topSpeedKmh} km/h</dd>
              <dt className="text-brand-ink-soft">Battery life</dt>
              <dd className="text-brand-ink">{sku.specs.batteryMin} min</dd>
              <dt className="text-brand-ink-soft">Charge time</dt>
              <dd className="text-brand-ink">{sku.specs.chargeMin} min</dd>
              <dt className="text-brand-ink-soft">Range</dt>
              <dd className="text-brand-ink">{sku.specs.rangeM} m</dd>
              <dt className="text-brand-ink-soft">LED</dt>
              <dd className="text-brand-ink">{sku.specs.led}</dd>
              <dt className="text-brand-ink-soft">Drift mode</dt>
              <dd className="text-brand-ink">{sku.specs.drift}</dd>
              <dt className="text-brand-ink-soft">Charger</dt>
              <dd className="text-brand-ink">USB-C</dd>
            </dl>
          </div>
        </details>

        {/* Reviews — sits inside the right column on mobile/lg, full-width
            visually thanks to mt + border-t inside ReviewsBlock */}
        <ReviewsBlock skuId={sku.id} />
      </div>
    </div>

    {/* Recently-viewed strip — full-width below the two-column PDP grid.
        Lives OUTSIDE the grid so the sticky image's stacking context
        cannot overlap these cards. */}
    <RecentlyViewed excludeId={sku.id} />

    {/* Desktop sticky CTA bar — slides in after scroll past Buy Now */}
    <PDPStickyCTA
      sku={sku}
      selectedColorSlug={selectedColorSlug}
      selectedColorName={selectedColor?.name}
      disabled={outOfStock}
    />
    </>
  );
}
