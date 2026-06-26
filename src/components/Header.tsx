"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ShoppingBag, Menu, X, ChevronLeft, ChevronDown } from "lucide-react";
import { WhatsAppIcon } from "@/components/BrandIcons";
import { THEME, waLink } from "@/lib/theme";
import { useCart, getCartCount } from "@/lib/cart-store";
import { trackFunnel } from "@/lib/funnel-client";
import { getSizes, SizeRow, SIZE_TEASER } from "@/lib/store-sizes";
import { cn } from "@/lib/utils";

// FAQ moved out of the top nav (it still lives on the home page) and replaced
// by the "Shop by size" menu below. Nav is split so the size dropdown can sit
// in FAQ's old slot — between Bundles and Track Order.
const NAV_BEFORE = [
  { label: "Shop", href: "/#sku" },
  { label: "Bundles", href: "/#bundles" },
];
const NAV_AFTER = [{ label: "Track Order", href: "/track" }];

// This store is the 1:64 "Pocket" store, so it marks 1:64 as "You're here".
const SIZES = getSizes("1:64");

export default function Header() {
  const items = useCart((s) => s.items);
  const openCart = useCart((s) => s.open);
  const hasHydrated = useCart((s) => s.hasHydrated);
  // Only trust the count once the persisted cart has rehydrated — keeps the
  // server-rendered markup (no badge) identical to the first client render.
  const cartCount = hasHydrated ? getCartCount(items) : 0;
  const pathname = usePathname();
  const router = useRouter();
  // Only the home page has a dark full-bleed hero behind the header.
  // Everywhere else (PDP, checkout, policy pages), keep the solid-bg style
  // even at scrollY === 0 — otherwise the white logo + nav are invisible
  // against the white page background.
  const isHomePage = pathname === "/";

  // Back button — shown on every non-home page so the buyer always has a
  // visible escape hatch alongside the browser back gesture. Tries
  // router.back() first (preserves Next.js state/scroll); falls back to
  // pushing "/" when there's no in-app history (e.g. deep-link landings,
  // Razorpay return URLs that opened a fresh tab).
  const handleBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push("/");
    }
  };

  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  // Mobile "Sizes" sheet — opened from an always-visible pill in the header bar
  // so the size switcher is reachable without opening the hamburger.
  const [sizeSheet, setSizeSheet] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Treat any non-home route as "scrolled" so the dark logo + dark nav
  // always render against the solid white header bg.
  // Also force solid style when the mobile menu is open — otherwise the
  // white logo / hamburger / cart icon are invisible against the open
  // white drawer, and the user has no way to close the menu.
  const useSolidStyle = !isHomePage || scrolled || mobileOpen || sizeSheet;

  return (
    <header
      className={cn(
        "sticky top-0 z-40 transition-all duration-300",
        useSolidStyle
          ? "bg-white/95 backdrop-blur-md border-b border-brand-line shadow-sm text-brand-ink"
          : "bg-transparent text-white"
      )}
    >
      <div className="w-full px-3 sm:px-5 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-18">
          {/* Back button — non-home pages only */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {!isHomePage && (
              <button
                type="button"
                onClick={handleBack}
                aria-label="Go back"
                className={cn(
                  "inline-flex items-center justify-center h-9 w-9 sm:h-10 sm:w-10 rounded-full transition-colors",
                  useSolidStyle
                    ? "hover:bg-brand-cream text-brand-ink"
                    : "hover:bg-white/10 text-white"
                )}
              >
                <ChevronLeft size={20} strokeWidth={2.5} />
              </button>
            )}
            {/* Logo */}
            <Link
              href="/"
              className="flex items-center gap-2 shrink-0"
              aria-label={`${THEME.brandName} home`}
            >
              <Image
                src={useSolidStyle ? THEME.logoDark : THEME.logoMain}
                alt={THEME.brandName}
                width={826}
                height={304}
                className="h-10 sm:h-12 lg:h-14 w-auto"
                priority
              />
            </Link>

            {/* Always-visible mobile size switcher — the desktop nav is hidden
                behind the hamburger on mobile, so this pill keeps "Shop by size"
                one tap away without opening the menu. */}
            <button
              type="button"
              onClick={() => {
                setSizeSheet((v) => !v);
                setMobileOpen(false);
              }}
              aria-expanded={sizeSheet}
              aria-label="Shop by size"
              className={cn(
                "lg:hidden inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1.5 text-xs font-semibold transition-colors",
                useSolidStyle
                  ? "bg-brand-red-soft text-brand-red"
                  : "bg-white/15 text-white backdrop-blur-sm"
              )}
            >
              Sizes
              <ChevronDown
                size={14}
                className={cn("transition-transform", sizeSheet && "rotate-180")}
              />
            </button>
          </div>

          {/* Desktop nav */}
          <nav className="hidden lg:flex items-center gap-8">
            {NAV_BEFORE.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "text-sm font-medium transition-colors",
                  useSolidStyle
                    ? "text-brand-ink-soft hover:text-brand-red"
                    : "text-white/80 hover:text-white"
                )}
              >
                {link.label}
              </Link>
            ))}

            {/* Shop by size — opens on hover or keyboard focus (pure CSS, no
                JS state needed on desktop). The panel itself is always a white
                card so it reads on both the transparent hero and solid header. */}
            <div className="relative group">
              <button
                type="button"
                className={cn(
                  "inline-flex items-center gap-1 text-sm font-medium transition-colors",
                  useSolidStyle
                    ? "text-brand-ink-soft hover:text-brand-red"
                    : "text-white/80 hover:text-white"
                )}
                aria-haspopup="true"
              >
                Shop by size
                <ChevronDown size={15} className="transition-transform group-hover:rotate-180" />
              </button>
              <div className="invisible absolute left-1/2 top-full z-50 w-72 -translate-x-1/2 pt-3 opacity-0 transition-all duration-150 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
                <div className="overflow-hidden rounded-2xl border border-brand-line bg-white text-brand-ink shadow-xl">
                  <ul className="p-1.5">
                    {SIZES.map((s) => (
                      <li key={s.scale}>
                        <SizeRow s={s} />
                      </li>
                    ))}
                  </ul>
                  <p className="border-t border-brand-line bg-brand-cream px-4 py-2.5 text-[11px] leading-snug text-brand-ink-soft">
                    {SIZE_TEASER}
                  </p>
                </div>
              </div>
            </div>

            {NAV_AFTER.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "text-sm font-medium transition-colors",
                  useSolidStyle
                    ? "text-brand-ink-soft hover:text-brand-red"
                    : "text-white/80 hover:text-white"
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Right cluster: WhatsApp + cart + mobile menu */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* WhatsApp pill - mobile shows icon-only to save thumb-zone real
                estate, sm+ adds the "Chat" label. Was previously hidden below
                sm, leaving ~80% of (mobile) traffic without a header CTA to
                contact us. The persistent FAB stays - this pill is the
                always-visible-at-top backup. Prefill is Hinglish so a DM
                lands qualified instead of generic. */}
            <a
              href={waLink("Hi! Mujhe ye Pocket RC drift car chahiye — price aur COD details bhej do?")}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => trackFunnel("whatsapp_click", { placement: "header" })}
              className="inline-flex items-center gap-1.5 sm:gap-2 bg-whatsapp-green hover:bg-whatsapp-green-hover text-white px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-sm font-semibold transition-colors"
              aria-label="Chat on WhatsApp"
            >
              <WhatsAppIcon size={16} />
              <span className="hidden sm:inline">Chat</span>
            </a>

            <button
              type="button"
              onClick={openCart}
              aria-label={`Cart (${cartCount} items)`}
              className={cn(
                "relative p-2.5 rounded-full transition-colors",
                useSolidStyle
                  ? "hover:bg-brand-cream text-brand-ink"
                  : "hover:bg-white/10 text-white"
              )}
            >
              <ShoppingBag size={20} />
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-brand-red text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
                  {cartCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                setMobileOpen((v) => !v);
                setSizeSheet(false);
              }}
              className={cn(
                "lg:hidden p-2.5 rounded-full transition-colors",
                useSolidStyle
                  ? "hover:bg-brand-cream text-brand-ink"
                  : "hover:bg-white/10 text-white"
              )}
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
            >
              {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile size sheet — opened by the always-visible "Sizes" pill, full
          width so every scale is clearly visible without opening the hamburger. */}
      {sizeSheet && (
        <>
          <button
            type="button"
            aria-hidden
            tabIndex={-1}
            onClick={() => setSizeSheet(false)}
            className="fixed inset-0 z-30 cursor-default lg:hidden"
          />
          <div className="relative z-40 lg:hidden bg-white border-t border-brand-line shadow-lg">
            <div className="px-2.5 py-2">
              <p className="px-3 pb-1 pt-1 font-mono text-[10px] uppercase tracking-widest text-brand-ink-soft">
                Shop by size
              </p>
              {SIZES.map((s) => (
                <SizeRow key={s.scale} s={s} onNavigate={() => setSizeSheet(false)} />
              ))}
              <p className="px-3 pt-2 text-[11px] leading-snug text-brand-ink-soft">
                {SIZE_TEASER}
              </p>
            </div>
          </div>
        </>
      )}

      {/* Mobile menu drawer */}
      {mobileOpen && (
        <div className="lg:hidden bg-white border-t border-brand-line shadow-lg">
          <nav className="px-4 py-3 flex flex-col">
            {[...NAV_BEFORE, ...NAV_AFTER].map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="py-3 text-base font-medium text-brand-ink hover:text-brand-red border-b border-brand-line last:border-b-0"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      )}
    </header>
  );
}
