"use client";

import Image from "next/image";
import { Truck, PackageCheck, ShieldCheck } from "lucide-react";
import { HERO_VARIANTS, type HeroVariant } from "@/lib/copy";
import { THEME } from "@/lib/theme";
import { defaultVariantSlug, getHeroSku } from "@/lib/products";
import { useCart } from "@/lib/cart-store";

export default function Hero({
  variant = "default",
}: {
  variant?: HeroVariant;
}) {
  const { h1, sub, ctaLabel } = HERO_VARIANTS[variant];

  const handlePrimaryCta = () => {
    const heroSku = getHeroSku();
    useCart.getState().add(heroSku.id, defaultVariantSlug(heroSku));
    useCart.getState().open();
  };

  return (
    <section className="relative overflow-hidden min-h-[100svh] bg-black isolate">
      {/* Background hero image — full-bleed.
          On mobile: shift the focus inward (65%) so we see the car body, not
          just the right edge. On desktop: object-right keeps the car on the
          right half so left text gets a clean dark backdrop. */}
      <Image
        src={THEME.heroImageSrc}
        alt=""
        priority
        fill
        sizes="100vw"
        className="object-cover select-none pointer-events-none [object-position:65%_center] sm:[object-position:right_center]"
      />

      {/* Readability gradient.
          Mobile: dark only at the very top (so H1 + body copy stay readable)
          then opens up sharply so the BMW headlights + body show through the
          middle and lower half. Previous values (95/80/55) were so heavy the
          car was effectively invisible. The bottom-vignette div below still
          handles the trust-strip backdrop separately, so we don't need extra
          darkness near the bottom here. Desktop side-gradient unchanged. */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/35 to-black/15 sm:bg-gradient-to-r sm:from-black sm:via-black/70 sm:to-transparent" />

      {/* Bottom vignette — taller on mobile so the trust strip pinned at the
          bottom always has a fully-dark backdrop. */}
      <div className="absolute inset-x-0 bottom-0 h-40 sm:h-32 bg-gradient-to-t from-black via-black/80 to-transparent" />

      {/* Content stack — left-aligned on desktop, centered on mobile */}
      <div className="relative z-10 max-w-7xl mx-auto px-5 sm:px-10 py-16 sm:py-28 min-h-[100svh] flex pb-36 sm:pb-40">
        <div className="w-full sm:max-w-xl flex flex-col justify-center text-left">
          <span
            className="hero-anim hero-anim-delay-1 block font-mono text-[10px] sm:text-xs uppercase tracking-[0.2em] text-white/80 mb-4 sm:mb-5 drop-shadow"
          >
            Made in Bangalore · 1:64 scale
          </span>

          <h1
            className="hero-anim hero-anim-delay-1 font-display text-white text-[2.75rem] leading-[0.95] sm:text-6xl md:text-7xl lg:text-8xl font-bold text-balance [text-shadow:0_2px_24px_rgba(0,0,0,0.55)]"
          >
            {variant === "default" ? (
              <>
                <span className="text-brand-red">Drift.</span> Race. Pocket.
              </>
            ) : (
              h1
            )}
          </h1>

          <p
            className="hero-anim hero-anim-delay-2 text-white text-base sm:text-lg md:text-xl max-w-md mt-5 sm:mt-7 [text-shadow:0_1px_12px_rgba(0,0,0,0.5)]"
          >
            {sub}
          </p>

          {/* Proof strip — three concrete differentiators in one line. Replaces
              vague "youthful" copy with the three lines that separate PRC from
              Amazon toy listings, surfaced before the price. */}
          <ul
            className="hero-anim hero-anim-delay-3 mt-5 sm:mt-6 flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] sm:text-xs font-mono uppercase tracking-widest text-white/90 max-w-md [text-shadow:0_1px_8px_rgba(0,0,0,0.6)]"
            aria-label="Why PRC Cars"
          >
            <li className="flex items-center gap-1.5">
              <span className="w-1 h-1 rounded-full bg-brand-red" />
              Everything in the box
            </li>
            <li className="flex items-center gap-1.5">
              <span className="w-1 h-1 rounded-full bg-brand-red" />
              Tested on tile, marble &amp; concrete
            </li>
            <li className="flex items-center gap-1.5">
              <span className="w-1 h-1 rounded-full bg-brand-red" />
              Real Yelahanka warehouse
            </li>
          </ul>

          {/* SEO-friendly money-keyword headline — visually small, semantically
              an h2 so Google sees "Mini RC Drift Cars from ₹999" while users
              still see the brand H1 above. */}
          <h2 className="sr-only">
            Mini RC Drift Cars from ₹999 — 2.4&nbsp;GHz, USB-C, Die-Cast
            alloy body. Pan-India COD, ships in 24&nbsp;hrs from Bangalore.
          </h2>

          <div className="hero-anim hero-anim-delay-4 mt-7 sm:mt-9 flex flex-col items-start gap-3">
            <button
              type="button"
              onClick={handlePrimaryCta}
              className="bg-brand-red hover:bg-brand-red-hover text-white px-8 py-4 sm:py-5 rounded-full font-semibold text-base sm:text-lg shadow-2xl transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center gap-2"
            >
              {ctaLabel}
            </button>
          </div>
        </div>
      </div>

      {/* Scroll indicator — bottom-left, just above the trust strip */}
      <div
        className="hero-anim hero-anim-delay-5 absolute z-20 left-6 sm:left-10 bottom-32 sm:bottom-28 hidden sm:flex items-center gap-3 pointer-events-none"
        aria-hidden
      >
        <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-white/55">scroll</span>
        <span className="block h-px w-12 bg-white/40 origin-left animate-pulse" />
      </div>

      {/* Trust strip pinned at bottom of hero viewport (3 columns) */}
      <div
        className="hero-anim hero-anim-delay-5 absolute z-20 inset-x-0 bottom-0 border-t border-white/15 bg-black/40 backdrop-blur-sm"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-10 py-4 sm:py-5 grid grid-cols-3 gap-2 sm:gap-6">
          <HeroTrustItem
            icon={<Truck className="w-4 h-4 sm:w-5 sm:h-5" />}
            title="Free shipping"
            sub="On orders ₹1,099+"
          />
          <HeroTrustItem
            icon={<PackageCheck className="w-4 h-4 sm:w-5 sm:h-5" />}
            title="24-hr dispatch"
            sub="From Bangalore"
          />
          <HeroTrustItem
            icon={<ShieldCheck className="w-4 h-4 sm:w-5 sm:h-5" />}
            title="7-day replacement"
            sub="Age 8+ · WhatsApp support"
          />
        </div>
      </div>
    </section>
  );
}

function HeroTrustItem({
  icon,
  title,
  sub,
}: {
  icon: React.ReactNode;
  title: string;
  sub: string;
}) {
  return (
    <div className="flex items-start sm:items-center gap-2 sm:gap-3 min-w-0">
      <span className="shrink-0 text-brand-red mt-0.5 sm:mt-0">{icon}</span>
      <div className="min-w-0">
        <div className="text-white font-semibold text-xs sm:text-sm leading-tight truncate">
          {title}
        </div>
        <div className="text-white/60 text-[10px] sm:text-xs leading-tight truncate">
          {sub}
        </div>
      </div>
    </div>
  );
}
