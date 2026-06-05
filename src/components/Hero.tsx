"use client";

import Image from "next/image";
import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { Truck, ShieldCheck } from "lucide-react";
import { HERO_VARIANTS, type HeroVariant } from "@/lib/copy";
import { THEME } from "@/lib/theme";
import { defaultVariantSlug, getHeroSku } from "@/lib/products";
import { useCart } from "@/lib/cart-store";

/**
 * Map the ad UTM source -> hero copy variant. Reads useSearchParams on the
 * client so the home page can be static (no searchParams in the server
 * render -> no per-request work -> edge-cacheable).
 *
 * Trade-off: the default variant SSRs and the IG-targeted variant swaps in
 * on hydration. For SEO this is preferable (Google indexes the default H1);
 * for paid traffic the swap happens before the user can read the H1.
 */
function heroVariantFromSource(source: string | null): HeroVariant {
  switch (source) {
    case "ig_gift":
      return "gift";
    case "ig_couple":
      return "couple";
    case "ig_parent":
      return "parent";
    case "ig_carride":
      return "carride";
    case "ig_drift":
    case "yt_drift":
      return "enthusiast";
    default:
      return "default";
  }
}

export default function Hero({
  variant: forcedVariant,
}: {
  variant?: HeroVariant;
}) {
  const sp = useSearchParams();
  const variant = useMemo<HeroVariant>(() => {
    if (forcedVariant && forcedVariant !== "default") return forcedVariant;
    return heroVariantFromSource(sp?.get("utm_source") ?? null);
  }, [forcedVariant, sp]);
  const { h1, h1Accent, sub, ctaLabel, underCta } = HERO_VARIANTS[variant];

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
      {/* Empty alt was intentional when hero was decorative behind text -
          but with the dark gradient now reduced (BMW visible), the image
          carries information for sighted users so screen-reader users need
          a description too. Also helps image SEO. */}
      <Image
        src={THEME.heroImageSrc}
        alt="Pocket BMW M-style 1:64 die-cast RC drift car, headlights lit, in front of a low-key red glow"
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
            className="hero-anim hero-anim-delay-1 font-display text-white text-[2.25rem] leading-[1.02] sm:text-5xl md:text-6xl lg:text-7xl font-bold text-balance [text-shadow:0_2px_24px_rgba(0,0,0,0.55)]"
          >
            {h1Accent && h1.toLowerCase().includes(h1Accent.toLowerCase()) ? (
              <>
                {h1
                  .split(new RegExp(`(${h1Accent})`, "i"))
                  .map((part, i) =>
                    part.toLowerCase() === h1Accent.toLowerCase() ? (
                      <span key={i} className="text-brand-red">
                        {part}
                      </span>
                    ) : (
                      part
                    ),
                  )}
              </>
            ) : (
              h1
            )}
            {/* Keyword-bearing tail for the H1 — invisible to sighted users
                so the gifting line stays clean, but it puts the primary SEO
                target ("RC drift cars from ₹999") inside the page's single
                H1 element for Google and gives screen-reader users a
                plain-language tail. */}
            <span className="sr-only">
              {" "}— Mini RC drift cars from ₹999, gift-ready box, COD pan-India.
            </span>
          </h1>

          <p
            className="hero-anim hero-anim-delay-2 text-white text-base sm:text-lg md:text-xl max-w-md mt-5 sm:mt-7 [text-shadow:0_1px_12px_rgba(0,0,0,0.5)]"
          >
            {sub}
          </p>

          {/* SEO h2 — keyword tail invisible to sighted users. */}
          <h2 className="sr-only">
            Mini RC Cars from ₹999 — 1:64 RC drift cars with 2.4&nbsp;GHz
            control, USB-C charging and a die-cast alloy body. Pan-India COD,
            ships in 24&nbsp;hrs from Bangalore.
          </h2>

          <div className="hero-anim hero-anim-delay-4 mt-7 sm:mt-9 flex flex-col items-start gap-3">
            <button
              type="button"
              onClick={handlePrimaryCta}
              className="bg-brand-red hover:bg-brand-red-hover text-white px-8 py-4 sm:py-5 rounded-full font-semibold text-base sm:text-lg shadow-2xl transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center gap-2"
            >
              {ctaLabel}
            </button>
            {/* Under-CTA relievers — placed where pre-pay fear lives. COD
                first because that's the #1 blocker on cold IG-gift traffic
                (Voss accusation-audit + Fogg motivation at the tap). */}
            <ul
              className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[11px] sm:text-xs font-mono uppercase tracking-widest text-white/90 max-w-md [text-shadow:0_1px_8px_rgba(0,0,0,0.6)]"
              aria-label="Why PRC Cars"
            >
              {underCta.map((item) => (
                <li key={item} className="flex items-center gap-1.5">
                  <span className="w-1 h-1 rounded-full bg-brand-red" />
                  {item}
                </li>
              ))}
            </ul>
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

      {/* F04 - Blocker-first 1-line trust strip pinned at bottom of hero.
          Order matters: COD first (the #1 India-RC blocker), then 7-day
          replacement (the dud-toy fear), then 24-hr dispatch (the impatience
          objection). Replaces the previous "Free shipping / 24-hr / 7-day"
          row which buried the biggest blocker. */}
      <div
        className="hero-anim hero-anim-delay-5 absolute z-20 inset-x-0 bottom-0 border-t border-white/15 bg-black/40 backdrop-blur-sm"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-10 py-3 sm:py-4 flex flex-wrap items-center justify-center gap-x-4 sm:gap-x-6 gap-y-1 text-[11px] sm:text-xs font-mono uppercase tracking-widest text-white/85 text-center">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-brand-red shrink-0" aria-hidden />
            COD pan-India · nothing now
          </span>
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-brand-red shrink-0" aria-hidden />
            7-day replacement
          </span>
          <span className="flex items-center gap-1.5">
            <Truck className="w-3.5 h-3.5 text-brand-red shrink-0" aria-hidden />
            Ships 24 hrs · Bangalore
          </span>
        </div>
      </div>
    </section>
  );
}
