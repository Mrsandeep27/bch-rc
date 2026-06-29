"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  ShieldCheck,
  Truck,
  Check,
  ShoppingBag,
  Zap,
  RotateCw,
} from "lucide-react";
import { Placeholder16 } from "./Placeholder16";
import BoxVideo16 from "./BoxVideo16";
import { useCart16 } from "@/lib/cart-store";
import { OFFERS } from "@/lib/config";
import { calcDiscountPct } from "@/lib/utils";
import { formatINR16, type Store16Product } from "@/lib/store16";

// Key selling points — the 1:16 hardware is shared across finishes, so these
// are common. Rendered as ⚡ bullets, matching the 1:64 PDP.
const SELLING_POINTS = [
  "4WD drivetrain · full-proportional 2.4 GHz control",
  "ESP electronic stability for clean, controllable drifts",
  "Rubber drift tyres + a spare set in the box",
  "Full LED lights · USB-C rechargeable battery",
];

/**
 * 1:16 product detail. Adds to the isolated useCart16 (skuId = slug, colourless
 * → variantSlug null), which opens the 16 cart drawer → /checkout?store=16.
 * Imagery is a placeholder until the real shoot lands.
 */
export default function Pdp16({ product }: { product: Store16Product }) {
  const router = useRouter();
  const add = useCart16((s) => s.add);
  const [added, setAdded] = useState(false);
  const [activeImg, setActiveImg] = useState(0);
  const [showStickyBar, setShowStickyBar] = useState(false);
  const onlinePrice = product.priceINR - OFFERS.prepaidDiscountINR;
  const gallery = product.images ?? [];
  // MRP anchor per series (mirrors the lineup card), for the slash + % off.
  const mrpINR = product.series === "Dares" ? 4999 : 3999;
  const savings = mrpINR - onlinePrice;
  const pct = calcDiscountPct(mrpINR, onlinePrice);

  const onAdd = () => {
    add(product.slug, null);
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  };

  // Buy now → add the item, then straight to the 1:16 checkout (skips the
  // drawer dwell). Mirrors the Lineup card's buy-now path.
  const onBuyNow = () => {
    add(product.slug, null);
    router.push("/checkout?store=16");
  };

  // Mobile sticky buy bar — reveal once the primary Add-to-cart button has
  // scrolled out of view, so the conversion action stays reachable while
  // reading specs / in-the-box on the long PDP.
  useEffect(() => {
    const onScroll = () => setShowStickyBar(window.scrollY > 480);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
    <section className="mx-auto max-w-6xl px-5 py-8 pb-24 sm:px-10 sm:py-12 lg:pb-12">
      <div className="grid gap-8 lg:grid-cols-2">
        {gallery.length > 0 ? (
          <div className="lg:sticky lg:top-24 lg:self-start">
            <div className="relative aspect-square w-full overflow-hidden rounded-2xl border border-brand-line bg-white shadow-sm">
              <Image
                src={gallery[activeImg] ?? gallery[0]}
                alt={product.name}
                fill
                sizes="(max-width: 1024px) 100vw, 512px"
                priority
                className="object-cover"
              />
            </div>
            {(gallery.length > 1 || product.boxVideo) && (
              <div
                className={`mt-3 grid gap-2 sm:gap-3 ${
                  product.boxVideo ? "grid-cols-5" : "grid-cols-4"
                }`}
              >
                {/* Box video first (Flipkart-style) — tap opens the player */}
                {product.boxVideo && (
                  <BoxVideo16
                    src={product.boxVideo.src}
                    poster={product.boxVideo.poster}
                    name={product.name}
                  />
                )}
                {gallery.map((img, i) => (
                  <button
                    key={img}
                    type="button"
                    onClick={() => setActiveImg(i)}
                    aria-label={`View image ${i + 1}`}
                    className={`relative aspect-square overflow-hidden rounded-lg border-2 bg-white transition-colors ${
                      i === activeImg
                        ? "border-brand-red"
                        : "border-brand-line hover:border-brand-ink/30"
                    }`}
                  >
                    <Image src={img} alt="" fill loading="lazy" sizes="120px" className="object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <Placeholder16
            label={`${product.name} — photo coming soon`}
            className="aspect-square w-full"
          />
        )}

        <div>
          <span className="font-mono text-[11px] uppercase tracking-[0.25em] text-brand-ink-soft">
            {product.series} · {product.edition}
          </span>
          <div className="mt-0.5 font-mono text-[11px] uppercase tracking-[0.25em] text-brand-red">
            1:16 RC drift car
          </div>
          <h1 className="mt-1 font-display text-3xl font-bold text-brand-ink sm:text-5xl">
            {product.name}
          </h1>
          <p className="mt-2 text-brand-ink-soft">{product.tagline}</p>

          {/* Price — online anchor + MRP slash + green save badge */}
          <div className="mt-5">
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="text-3xl font-bold text-brand-ink sm:text-4xl">
                {formatINR16(onlinePrice)}
              </span>
              <span className="font-mono text-[10px] uppercase tracking-widest text-brand-ink-soft">
                online
              </span>
              <span className="text-base text-brand-ink-soft line-through">
                {formatINR16(mrpINR)}
              </span>
              <span className="rounded bg-success/10 px-2 py-0.5 text-xs font-semibold text-success sm:text-sm">
                Save {formatINR16(savings)} · {pct}% off
              </span>
            </div>
            <p className="mt-1 text-xs text-brand-ink-soft sm:text-sm">
              or {formatINR16(product.priceINR)} cash on delivery · all taxes included
            </p>
          </div>

          {/* Feature bullets */}
          <ul className="mt-5 space-y-2">
            {SELLING_POINTS.map((b) => (
              <li key={b} className="flex items-start gap-2 text-sm text-brand-ink">
                <Zap size={16} className="mt-0.5 shrink-0 text-brand-red" aria-hidden />
                <span>{b}</span>
              </li>
            ))}
          </ul>

          {/* CTAs — primary Buy now, secondary Add to cart */}
          <div className="mt-6 flex flex-col gap-3">
            <button
              type="button"
              onClick={onBuyNow}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-brand-red px-8 py-4 text-base font-semibold text-white shadow-xl transition-transform hover:scale-[1.01] active:scale-[0.99]"
            >
              <Zap className="h-4 w-4" aria-hidden />
              Buy now — {formatINR16(onlinePrice)}
            </button>

            <button
              type="button"
              onClick={onAdd}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full border-2 border-brand-ink/15 bg-white px-8 py-3.5 text-base font-semibold text-brand-ink transition-colors hover:border-brand-ink"
            >
              {added ? (
                <>
                  <Check className="h-4 w-4" /> Added to cart
                </>
              ) : (
                <>
                  <ShoppingBag className="h-4 w-4" /> Add to cart
                </>
              )}
            </button>
          </div>

          {/* Trust grid */}
          <div className="mt-6 grid grid-cols-3 gap-3 text-center">
            <div className="rounded-lg border border-brand-line p-3">
              <Truck size={18} className="mx-auto text-brand-red" aria-hidden />
              <p className="mt-1.5 text-[11px] font-semibold text-brand-ink">
                Ships 24 hrs
              </p>
              <p className="text-[10px] text-brand-ink-soft">from Bangalore</p>
            </div>
            <div className="rounded-lg border border-brand-line p-3">
              <RotateCw size={18} className="mx-auto text-brand-red" aria-hidden />
              <p className="mt-1.5 text-[11px] font-semibold text-brand-ink">7-Day</p>
              <p className="text-[10px] text-brand-ink-soft">Replacement</p>
            </div>
            <div className="rounded-lg border border-brand-line p-3">
              <ShieldCheck size={18} className="mx-auto text-brand-red" aria-hidden />
              <p className="mt-1.5 text-[11px] font-semibold text-brand-ink">COD</p>
              <p className="text-[10px] text-brand-ink-soft">pan-India</p>
            </div>
          </div>

          {/* What's in the box — bordered card, two columns */}
          <div className="mt-6 rounded-xl border border-brand-line bg-brand-cream p-4 sm:p-5">
            <p className="font-mono text-[10px] font-semibold uppercase tracking-widest text-brand-red sm:text-xs">
              What&apos;s in the box
            </p>
            <ul className="mt-2 grid grid-cols-1 gap-x-4 gap-y-1.5 text-xs text-brand-ink sm:grid-cols-2 sm:text-sm">
              {product.inBox.map((s) => (
                <li key={s}>· {s}</li>
              ))}
            </ul>
          </div>

          {/* Description + full specs */}
          <p className="mt-6 text-brand-ink">{product.description}</p>

          <h2 className="mt-6 font-display text-lg font-bold text-brand-ink">
            Specs
          </h2>
          <ul className="mt-2 space-y-1.5 text-sm text-brand-ink-soft">
            {product.specs.map((s) => (
              <li key={s} className="flex gap-2">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-red" aria-hidden />
                {s}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>

    {/* Mobile sticky buy bar — keeps the price + add-to-cart in reach on the
        long scroll. Hidden on lg where the layout keeps the CTA near the top. */}
    <div
      className={`fixed inset-x-0 bottom-0 z-40 lg:hidden transition-transform duration-300 ${
        showStickyBar ? "translate-y-0" : "translate-y-full"
      }`}
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-hidden={!showStickyBar}
    >
      <div className="border-t border-brand-line bg-white/95 px-4 py-2.5 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="truncate font-mono text-[10px] uppercase tracking-widest text-brand-ink-soft">
              {product.name}
            </div>
            <div className="flex items-baseline gap-1.5 leading-tight">
              <span className="text-lg font-bold text-brand-ink">
                {formatINR16(onlinePrice)}
              </span>
              <span className="font-mono text-[10px] uppercase tracking-widest text-brand-ink-soft">
                online
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onAdd}
            className="inline-flex min-h-[44px] shrink-0 items-center justify-center gap-2 rounded-full bg-brand-red px-6 py-3 text-sm font-semibold text-white transition-transform active:scale-[0.98]"
          >
            {added ? (
              <>
                <Check className="h-4 w-4" /> Added
              </>
            ) : (
              <>
                <ShoppingBag className="h-4 w-4" /> Add to cart
              </>
            )}
          </button>
        </div>
      </div>
    </div>
    </>
  );
}
