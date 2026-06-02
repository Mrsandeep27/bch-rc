"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Minus, Plus, ShoppingBag, Zap, Truck, Shield, RotateCw } from "lucide-react";
import type { Sku } from "@/lib/products";
import { formatINR, calcDiscountPct, cn } from "@/lib/utils";
import { useCart } from "@/lib/cart-store";
import { ProductPlaceholder } from "@/components/ProductPlaceholder";

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
      sizes="(max-width: 768px) 90vw, 50vw"
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
  const selectedColor =
    sku.colors?.find((c) => c.slug === selectedColorSlug) ?? null;
  const savings = sku.mrpINR - sku.retailINR;
  const pct = calcDiscountPct(sku.mrpINR, sku.retailINR);
  // Color-specific hero overrides the base hero; alt angles are shared across colors.
  const heroSrc = selectedColor?.image ?? sku.heroImage;
  // Per-color alt angles don't exist yet — when colors are defined for this
  // SKU, show ONLY the single color hero (no thumbnails) so the gallery
  // stays consistent with the swatch the user picked.
  const gallery = sku.colors?.length
    ? [heroSrc]
    : [heroSrc, ...sku.altImages].filter(Boolean);
  const activeSrc = gallery[activeImage] ?? heroSrc;

  function addToCart() {
    useCart.getState().add(sku.id, qty);
  }

  function buyNow() {
    useCart.getState().add(sku.id, qty);
    router.push("/checkout");
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 max-w-6xl mx-auto px-4 py-8">
      {/* Image gallery */}
      <div className="lg:sticky lg:top-20 lg:self-start space-y-3">
        <div className="aspect-square rounded-2xl overflow-hidden border border-brand-line bg-white relative">
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
          <span className="inline-block bg-brand-red text-white text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full mb-3">
            {sku.badge}
          </span>
        )}
        <p className="text-xs font-mono uppercase tracking-widest text-brand-ink-soft">
          {sku.scale} · {sku.bodyShape}
        </p>
        <h1 className="text-3xl sm:text-4xl font-bold text-brand-ink mt-1 text-balance">
          {sku.name}
        </h1>
        <p className="text-lg text-brand-ink-soft mt-2">{sku.tagline}</p>

        {/* Rating row */}
        <div className="flex items-center gap-2 mt-4 text-sm">
          <span className="text-gold">★★★★★</span>
          <span className="font-semibold text-brand-ink">4.7</span>
          <span className="text-brand-ink-soft">· 238 verified reviews</span>
        </div>

        {/* Price block */}
        <div className="mt-6">
          <div className="flex items-baseline gap-3 flex-wrap">
            <span className="text-4xl font-bold text-brand-ink">
              {formatINR(sku.retailINR)}
            </span>
            <span className="text-lg text-brand-ink-soft line-through">
              {formatINR(sku.mrpINR)}
            </span>
            <span className="text-sm font-semibold bg-success/10 text-success px-2 py-0.5 rounded">
              Save {formatINR(savings)} · {pct}% off
            </span>
          </div>
          <p className="text-xs text-brand-ink-soft mt-2">
            Inclusive of all taxes · Pay online → save ₹100
          </p>
        </div>

        {/* Color picker */}
        {sku.colors && sku.colors.length > 0 && (
          <div className="mt-6">
            <div className="flex items-baseline justify-between">
              <span className="text-xs font-mono uppercase tracking-widest text-brand-ink-soft">
                Colour
              </span>
              {selectedColor && (
                <span className="text-sm font-semibold text-brand-ink">
                  {selectedColor.name}
                </span>
              )}
            </div>
            <div className="mt-2.5 flex flex-wrap gap-2">
              {sku.colors.map((c) => {
                const active = c.slug === selectedColorSlug;
                return (
                  <button
                    key={c.slug}
                    type="button"
                    onClick={() => {
                      setSelectedColorSlug(c.slug);
                      setActiveImage(0);
                    }}
                    aria-label={c.name}
                    aria-pressed={active}
                    className={cn(
                      "w-9 h-9 rounded-full border-2 transition-all relative",
                      active
                        ? "border-brand-ink ring-2 ring-offset-2 ring-brand-red"
                        : "border-brand-line hover:border-brand-ink-soft"
                    )}
                    style={{ background: swatchBg(c.swatch) }}
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* Bullets */}
        <ul className="mt-6 space-y-2">
          {sku.bullets.map((b) => (
            <li key={b} className="flex items-start gap-2 text-sm text-brand-ink">
              <Zap size={16} className="text-brand-red shrink-0 mt-0.5" />
              <span>{b}</span>
            </li>
          ))}
        </ul>

        {/* Qty + CTAs */}
        <div className="mt-7 flex items-stretch gap-3">
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
              onClick={() => setQty(qty + 1)}
              className="w-11 h-11 flex items-center justify-center text-brand-ink-soft hover:text-brand-ink"
              aria-label="Increase quantity"
            >
              <Plus size={16} />
            </button>
          </div>
          <button
            type="button"
            onClick={addToCart}
            className="flex-1 bg-white border-2 border-brand-ink text-brand-ink hover:bg-brand-ink hover:text-white px-5 py-3 rounded-xl font-semibold text-sm transition-colors inline-flex items-center justify-center gap-2"
          >
            <ShoppingBag size={16} />
            Add to Cart
          </button>
        </div>
        <button
          type="button"
          onClick={buyNow}
          className="mt-3 w-full bg-brand-red hover:bg-brand-red-hover text-white py-4 rounded-xl font-bold text-base transition-colors"
        >
          Buy Now · {formatINR(sku.retailINR * qty)}
        </button>

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
              BIS Certified
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
      </div>
    </div>
  );
}
