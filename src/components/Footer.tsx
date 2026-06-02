import Link from "next/link";
import Image from "next/image";
import { MapPin, Phone, Mail } from "lucide-react";
import {
  InstagramIcon,
  YoutubeIcon,
  WhatsAppIcon,
} from "@/components/BrandIcons";
import { waLink } from "@/lib/config";
import { THEME } from "@/lib/theme";

const QUICK_LINKS = [
  { label: "Home", href: "/" },
  { label: "Shop the lineup", href: "/#sku" },
  { label: "Track order", href: "/track" },
  { label: "Privacy Policy", href: "/policies/privacy" },
  { label: "Terms of Service", href: "/policies/terms" },
  { label: "Shipping & Replacement", href: "/policies/shipping" },
] as const;

// Google Maps embed for Yelahanka 1st Stage HQ (Bharath Cycle Hub registered
// address). Uses the unauthenticated "?q=..." iframe URL — no API key needed.
const MAP_SRC =
  "https://www.google.com/maps?q=" +
  encodeURIComponent(
    "HIG A Sector, Yelahanka 1st Stage, Bengaluru, Karnataka 560064"
  ) +
  "&output=embed";

const MAP_LINK = "https://maps.google.com/?q=" + encodeURIComponent(
  "HIG A Sector, Yelahanka 1st Stage, Bengaluru, Karnataka 560064"
);

export default function Footer() {
  return (
    <footer className="bg-brand-ink text-white pt-12 pb-6">
      <div className="max-w-6xl mx-auto px-4">
        {/* Top: 4-column block */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">
          {/* 1. Logo + pitch + socials */}
          <div>
            <Link href="/" aria-label={`${THEME.brandName} home`}>
              <Image
                src={THEME.logoMain}
                alt={THEME.brandName}
                width={826}
                height={304}
                className="h-14 w-auto"
              />
            </Link>
            <p className="text-sm text-neutral-400 mt-4 leading-relaxed">
              India&apos;s most-gifted mini RC drift cars. Pan-India COD, ships
              in 24 hrs from Bangalore.
            </p>
            <div className="flex items-center gap-3 mt-5">
              <a
                href="https://youtube.com/@pocketrccars"
                target="_blank"
                rel="noopener"
                aria-label="YouTube"
                className="w-9 h-9 rounded-full bg-white/5 hover:bg-brand-red flex items-center justify-center transition-colors"
              >
                <YoutubeIcon size={16} />
              </a>
              <a
                href={`https://instagram.com/${THEME.instagramHandle}`}
                target="_blank"
                rel="noopener"
                aria-label="Instagram"
                className="w-9 h-9 rounded-full bg-white/5 hover:bg-brand-red flex items-center justify-center transition-colors"
              >
                <InstagramIcon size={16} />
              </a>
              <a
                href={waLink()}
                target="_blank"
                rel="noopener"
                aria-label="WhatsApp"
                className="w-9 h-9 rounded-full bg-white/5 hover:bg-whatsapp-green flex items-center justify-center transition-colors"
              >
                <WhatsAppIcon size={16} />
              </a>
            </div>
          </div>

          {/* 2. Contact us */}
          <div>
            <h3 className="font-display font-bold tracking-wider text-white text-sm uppercase mb-4">
              Contact Us
            </h3>
            <ul className="space-y-3 text-sm text-neutral-300">
              <li className="flex items-start gap-2.5">
                <MapPin size={16} className="text-brand-red shrink-0 mt-0.5" />
                <span className="leading-snug">
                  Yelahanka 1st Stage, Bengaluru 560064
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <Phone size={16} className="text-brand-red shrink-0 mt-0.5" />
                <a
                  href={waLink()}
                  target="_blank"
                  rel="noopener"
                  className="hover:text-white"
                >
                  {THEME.phoneDisplay}
                </a>
              </li>
              <li className="flex items-start gap-2.5">
                <Mail size={16} className="text-brand-red shrink-0 mt-0.5" />
                <a
                  href={`mailto:${THEME.email}`}
                  className="hover:text-white break-all"
                >
                  {THEME.email}
                </a>
              </li>
            </ul>
          </div>

          {/* 3. Quick links */}
          <div>
            <h3 className="font-display font-bold tracking-wider text-white text-sm uppercase mb-4">
              Quick Links
            </h3>
            <ul className="space-y-2.5">
              {QUICK_LINKS.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="text-sm text-brand-red hover:text-white transition-colors"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* 4. Ships from (Map) */}
          <div>
            <h3 className="font-display font-bold tracking-wider text-white text-sm uppercase mb-4">
              Ships From
            </h3>
            <a
              href={MAP_LINK}
              target="_blank"
              rel="noopener"
              className="relative block rounded-xl overflow-hidden border border-white/10 hover:border-brand-red transition-colors"
              aria-label="Open warehouse address in Google Maps"
            >
              <iframe
                src={MAP_SRC}
                title="PRC Cars warehouse — Yelahanka, Bengaluru"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                className="w-full h-36 block pointer-events-none"
              />
              <span className="absolute top-2 left-2 bg-brand-red text-white text-[9px] font-mono uppercase tracking-widest px-2 py-1 rounded-full">
                Warehouse
              </span>
            </a>
            <p className="text-xs text-neutral-400 mt-2 leading-snug">
              Yelahanka 1st Stage, Bengaluru
              <br />
              <span className="text-brand-red font-semibold">
                Flagship store · Coming soon
              </span>
            </p>
          </div>
        </div>

        {/* Bottom strip */}
        <div className="mt-10 pt-6 border-t border-white/10 text-center">
          <p className="text-sm text-neutral-300">
            © 2026 {THEME.brandName}. All rights reserved.
          </p>
          <p className="text-xs text-brand-red mt-1">
            Pocket-priced 1:64 drift cars · Made for India
          </p>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[11px] text-neutral-500">
            <span>Registered Business</span>
            <span className="text-neutral-700">|</span>
            <span className="font-mono">GSTIN {THEME.legal.gstin}</span>
            <span className="text-neutral-700">|</span>
            <span>Yelahanka, Bengaluru, Karnataka</span>
            <span className="text-neutral-700">|</span>
            <span>Open Mon–Sun: 10AM – 8:30PM</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
