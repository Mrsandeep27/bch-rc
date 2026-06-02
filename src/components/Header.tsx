"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ShoppingBag, Menu, X } from "lucide-react";
import { WhatsAppIcon } from "@/components/BrandIcons";
import { THEME, waLink } from "@/lib/theme";
import { useCart, getCartCount } from "@/lib/cart-store";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { label: "Shop", href: "/#sku" },
  { label: "Bundles", href: "/#bundles" },
  { label: "FAQ", href: "/#faq" },
  { label: "Track Order", href: "/track" },
];

export default function Header() {
  const items = useCart((s) => s.items);
  const openCart = useCart((s) => s.open);
  const cartCount = getCartCount(items);
  const pathname = usePathname();
  // Only the home page has a dark full-bleed hero behind the header.
  // Everywhere else (PDP, checkout, policy pages), keep the solid-bg style
  // even at scrollY === 0 — otherwise the white logo + nav are invisible
  // against the white page background.
  const isHomePage = pathname === "/";

  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Treat any non-home route as "scrolled" so the dark logo + dark nav
  // always render against the solid white header bg.
  const useSolidStyle = !isHomePage || scrolled;

  return (
    <header
      className={cn(
        "sticky top-8 z-40 transition-all duration-300",
        useSolidStyle
          ? "bg-white/95 backdrop-blur-md border-b border-brand-line shadow-sm text-brand-ink"
          : "bg-transparent text-white"
      )}
    >
      <div className="w-full px-3 sm:px-5 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-18">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 shrink-0" aria-label={`${THEME.brandName} home`}>
            <Image
              src={useSolidStyle ? THEME.logoDark : THEME.logoMain}
              alt={THEME.brandName}
              width={826}
              height={304}
              className="h-10 sm:h-12 lg:h-14 w-auto"
              priority
            />
          </Link>

          {/* Desktop nav */}
          <nav className="hidden lg:flex items-center gap-8">
            {NAV_LINKS.map((link) => (
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
            <a
              href={waLink("Hi, I'm interested in the Pocket RC mini drift car.")}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:inline-flex items-center gap-2 bg-whatsapp-green hover:bg-whatsapp-green-hover text-white px-4 py-2 rounded-full text-sm font-semibold transition-colors"
              aria-label="Chat on WhatsApp"
            >
              <WhatsAppIcon size={16} />
              <span>Chat</span>
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
              onClick={() => setMobileOpen((v) => !v)}
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

      {/* Mobile menu drawer */}
      {mobileOpen && (
        <div className="lg:hidden bg-white border-t border-brand-line shadow-lg">
          <nav className="px-4 py-3 flex flex-col">
            {NAV_LINKS.map((link) => (
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
