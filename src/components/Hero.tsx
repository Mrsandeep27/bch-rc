"use client";

import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Truck, PackageCheck, ShieldCheck } from "lucide-react";
import { HERO_VARIANTS, type HeroVariant } from "@/lib/copy";
import { THEME } from "@/lib/theme";
import { getHeroSku } from "@/lib/products";
import { useCart } from "@/lib/cart-store";
import LaunchCountdown from "@/components/LaunchCountdown";

function getVariantFromSource(source: string | null): HeroVariant {
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

export default function Hero() {
  const searchParams = useSearchParams();
  const utmSource = searchParams.get("utm_source");
  const variant = getVariantFromSource(utmSource);
  const { h1, sub, ctaLabel } = HERO_VARIANTS[variant];

  const handlePrimaryCta = () => {
    const heroSku = getHeroSku();
    useCart.getState().add(heroSku.id);
    useCart.getState().open();
  };

  return (
    <section className="relative overflow-hidden min-h-screen bg-black isolate">
      {/* Background hero image — full-bleed */}
      <Image
        src={THEME.heroImageSrc}
        alt=""
        priority
        fill
        sizes="100vw"
        className="object-cover object-right select-none pointer-events-none"
      />

      {/* Left-side darkening gradient — keeps text readable over the car edge */}
      <div className="absolute inset-0 bg-gradient-to-r from-black via-black/85 to-black/10 sm:from-black sm:via-black/70 sm:to-transparent" />

      {/* Subtle bottom-vignette */}
      <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black to-transparent" />

      {/* Content stack — left-aligned on desktop, centered on mobile */}
      <div className="relative z-10 max-w-7xl mx-auto px-6 sm:px-10 py-20 sm:py-28 min-h-screen flex pb-44 sm:pb-40">
        <div className="w-full sm:max-w-xl flex flex-col justify-center text-left">
          {/* Launch-week offer chip — slim, sits inline above the eyebrow */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="mb-4 sm:mb-5"
          >
            <div className="inline-flex items-center gap-2.5 bg-brand-red/95 text-white pl-2 pr-3.5 py-1.5 rounded-full shadow-lg backdrop-blur-sm">
              <span className="flex items-center gap-1.5 bg-white text-brand-red text-[9px] font-mono font-bold uppercase tracking-widest px-2 py-0.5 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-brand-red animate-pulse" />
                Launch Week
              </span>
              <span className="font-display font-bold text-sm sm:text-base leading-none">
                Flat 35% off
              </span>
              <span className="hidden sm:flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest text-white/80 border-l border-white/30 pl-2.5">
                ends in <LaunchCountdown variant="chip" />
              </span>
            </div>
          </motion.div>

          <motion.span
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.05, ease: "easeOut" }}
            className="font-mono text-[10px] sm:text-xs uppercase tracking-[0.2em] text-white/65 mb-4 sm:mb-5"
          >
            Made in Bangalore · 1:64 scale
          </motion.span>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.05, ease: "easeOut" }}
            className="font-display text-white text-[2.75rem] leading-[0.95] sm:text-6xl md:text-7xl lg:text-8xl font-bold text-balance"
          >
            {variant === "default" ? (
              <>
                <span className="text-brand-red">Drift.</span> Race. Pocket.
              </>
            ) : (
              h1
            )}
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15, ease: "easeOut" }}
            className="text-white/85 text-base sm:text-lg md:text-xl max-w-md mt-5 sm:mt-7"
          >
            {sub}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.25, ease: "easeOut" }}
            className="mt-8 sm:mt-10 flex flex-col items-start gap-4"
          >
            <button
              type="button"
              onClick={handlePrimaryCta}
              className="bg-brand-red hover:bg-brand-red-hover text-white px-8 py-4 sm:py-5 rounded-full font-semibold text-base sm:text-lg shadow-2xl transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center gap-2"
            >
              {ctaLabel}
            </button>
          </motion.div>
        </div>
      </div>

      {/* Scroll indicator — bottom-left, just above the trust strip */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.6 }}
        className="absolute z-20 left-6 sm:left-10 bottom-32 sm:bottom-28 hidden sm:flex items-center gap-3 pointer-events-none"
        aria-hidden
      >
        <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-white/55">scroll</span>
        <span className="block h-px w-12 bg-white/40 origin-left animate-pulse" />
      </motion.div>

      {/* Trust strip pinned at bottom of hero viewport (3 columns) */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.5, ease: "easeOut" }}
        className="absolute z-20 inset-x-0 bottom-0 border-t border-white/15 bg-black/40 backdrop-blur-sm"
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
            title="BIS certified"
            sub="Age 8+ · 7-day returns"
          />
        </div>
      </motion.div>
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
