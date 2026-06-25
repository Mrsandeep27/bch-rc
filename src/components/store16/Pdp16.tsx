"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { ShieldCheck, Truck, ArrowRight, Check, ShoppingBag } from "lucide-react";
import { Placeholder16 } from "./Placeholder16";
import { useCart16 } from "@/lib/cart-store";
import { OFFERS } from "@/lib/config";
import { formatINR16, type Store16Product } from "@/lib/store16";

/**
 * 1:16 product detail. Adds to the isolated useCart16 (skuId = slug, colourless
 * → variantSlug null), which opens the 16 cart drawer → /checkout?store=16.
 * Imagery is a placeholder until the real shoot lands.
 */
export default function Pdp16({ product }: { product: Store16Product }) {
  const add = useCart16((s) => s.add);
  const [added, setAdded] = useState(false);
  const [activeImg, setActiveImg] = useState(0);
  const [showStickyBar, setShowStickyBar] = useState(false);
  const onlinePrice = product.priceINR - OFFERS.prepaidDiscountINR;
  const gallery = product.images ?? [];

  const onAdd = () => {
    add(product.slug, null);
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
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
          <div className="lg:sticky lg:top-24">
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
            {gallery.length > 1 && (
              <div className="mt-3 grid grid-cols-4 gap-2 sm:gap-3">
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
                    <Image src={img} alt="" fill sizes="120px" className="object-cover" />
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
          <span className="font-mono text-[11px] uppercase tracking-[0.25em] text-brand-red">
            {product.series} · {product.edition}
          </span>
          <h1 className="mt-2 font-display text-3xl font-bold text-brand-ink sm:text-5xl">
            {product.name}
          </h1>
          <p className="mt-2 text-brand-ink-soft">{product.tagline}</p>

          <div className="mt-4">
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="text-3xl font-bold text-brand-ink">
                {formatINR16(onlinePrice)}
              </span>
              <span className="font-mono text-[10px] uppercase tracking-widest text-brand-ink-soft">
                online
              </span>
              <span className="rounded-full bg-brand-red-soft px-3 py-1 text-xs font-semibold text-brand-red">
                save ₹100 vs COD
              </span>
            </div>
            <div className="mt-1 font-mono text-[12px] text-brand-ink-soft">
              or {formatINR16(product.priceINR)} cash on delivery · pan-India
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2">
            <span
              aria-hidden
              className="h-5 w-5 rounded-full border border-black/10 shadow-sm"
              style={
                product.swatch2
                  ? { background: `linear-gradient(135deg, ${product.swatch} 50%, ${product.swatch2} 50%)` }
                  : { background: product.swatch }
              }
            />
            <span className="font-mono text-[11px] uppercase tracking-widest text-brand-ink-soft">
              {product.colorway}
            </span>
          </div>

          <button
            type="button"
            onClick={onAdd}
            className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-brand-red px-8 py-4 text-base font-semibold text-white shadow-xl transition-transform hover:scale-[1.01] active:scale-[0.99] sm:w-auto"
          >
            {added ? (
              <>
                <Check className="h-4 w-4" /> Added to cart
              </>
            ) : (
              <>
                Add to cart — {formatINR16(onlinePrice)}
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>

          <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-brand-ink-soft">
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-brand-red" aria-hidden />
              7-day replacement
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Truck className="h-3.5 w-3.5 text-brand-red" aria-hidden />
              Ships from Bangalore
            </span>
          </p>

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

          <h2 className="mt-6 font-display text-lg font-bold text-brand-ink">
            In the box
          </h2>
          <ul className="mt-2 space-y-1.5 text-sm text-brand-ink-soft">
            {product.inBox.map((s) => (
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
