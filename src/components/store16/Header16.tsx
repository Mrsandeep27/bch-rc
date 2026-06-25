"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { ShoppingBag, Menu, X, ChevronLeft } from "lucide-react";
import { WhatsAppIcon } from "@/components/BrandIcons";
import { THEME } from "@/lib/theme";
import { useCart16, getCartCount } from "@/lib/cart-store";
import { trackFunnel } from "@/lib/funnel-client";
import { store16WaLink } from "@/lib/store16";
import { cn } from "@/lib/utils";

// Same chrome as the 1:64 Header, scoped to the 1:16 store: nav points at the
// /16 sections, links route to /16, copy is 1:16. Shared brand bits (PRC logo,
// WhatsApp line) stay identical. Colours come from the .store-16 scope (slate).
const NAV_LINKS = [
  { label: "Shop", href: "/16#lineup" },
  { label: "Bundles", href: "/16#bundles" },
  { label: "FAQ", href: "/16#faq" },
  { label: "Track Order", href: "/track" },
];

export default function Header16() {
  const items = useCart16((s) => s.items);
  const openCart = useCart16((s) => s.open);
  const hasHydrated = useCart16((s) => s.hasHydrated);
  const cartCount = hasHydrated ? getCartCount(items) : 0;
  const pathname = usePathname();
  const router = useRouter();
  // The 1:16 home (/16) has the dark hero behind the header — keep it
  // transparent there, solid everywhere else.
  const isHomePage = pathname === "/16";

  const handleBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push("/16");
    }
  };

  const [mobileOpen, setMobileOpen] = useState(false);

  // The /16 home has a full-section dark banner hero — float the header over it
  // (transparent, white text, light logo). Every other 1:16 page is light, so
  // the header is solid there.
  const useSolidStyle = !isHomePage;

  return (
    <header
      className={cn(
        "z-40 transition-all duration-300",
        useSolidStyle
          ? "sticky top-0 bg-white/95 backdrop-blur-md border-b border-brand-line shadow-sm text-brand-ink"
          : "absolute inset-x-0 top-0 bg-transparent text-white",
      )}
    >
      <div className="w-full px-3 sm:px-5 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-18">
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
                    : "hover:bg-white/10 text-white",
                )}
              >
                <ChevronLeft size={20} strokeWidth={2.5} />
              </button>
            )}
            <Link
              href="/16"
              className="flex items-center shrink-0"
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
          </div>

          <nav className="hidden lg:flex items-center gap-8">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "text-sm font-medium transition-colors",
                  useSolidStyle
                    ? "text-brand-ink-soft hover:text-brand-red"
                    : "text-white/80 hover:text-white",
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            <a
              href={store16WaLink(
                "Hi! I want a PRC drift car — price aur COD details bhej do?",
              )}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => trackFunnel("whatsapp_click", { placement: "header16" })}
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
                  : "hover:bg-white/10 text-white",
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
                  : "hover:bg-white/10 text-white",
              )}
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
            >
              {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </div>

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
