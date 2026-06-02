"use client";

import { useEffect, useState } from "react";
import { X, Copy, Check } from "lucide-react";
import { WhatsAppIcon } from "@/components/BrandIcons";
import { waLink } from "@/lib/config";

const STORAGE_KEY = "prc-exit-shown";
const COUPON = "DRIFT100";

/**
 * One-time-per-session exit-intent modal. Fires when the mouse leaves the
 * window through the top edge (desktop) or after 25s of idle scroll-up on
 * mobile. Offers a ₹100 coupon -- copy-to-clipboard + WhatsApp deep-link to
 * capture the lead in our DMs.
 */
export default function ExitIntentModal() {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem(STORAGE_KEY)) return;

    let shown = false;
    const trigger = () => {
      if (shown) return;
      shown = true;
      sessionStorage.setItem(STORAGE_KEY, "1");
      setOpen(true);
    };

    // Desktop: mouseleave through the TOP edge of the viewport
    const onMouseOut = (e: MouseEvent) => {
      if (e.clientY <= 0 && !e.relatedTarget) trigger();
    };

    // Mobile fallback: fire after 25 sec if user is still on the page
    const mobileTimer = window.setTimeout(() => {
      if (window.innerWidth < 768) trigger();
    }, 25_000);

    document.addEventListener("mouseout", onMouseOut);
    return () => {
      document.removeEventListener("mouseout", onMouseOut);
      window.clearTimeout(mobileTimer);
    };
  }, []);

  function copyCoupon() {
    navigator.clipboard.writeText(COUPON);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Special offer — ₹100 off your first drift"
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
    >
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Close offer"
          className="absolute top-3 right-3 w-9 h-9 rounded-full bg-black/5 hover:bg-black/10 flex items-center justify-center text-brand-ink z-10"
        >
          <X size={18} />
        </button>

        {/* Red top band */}
        <div className="bg-brand-red text-white px-6 py-5 text-center">
          <p className="text-[10px] font-mono uppercase tracking-widest opacity-90">
            Wait — before you go
          </p>
          <p className="font-display text-3xl sm:text-4xl font-bold mt-1 leading-tight">
            ₹100 OFF
          </p>
          <p className="text-sm opacity-90 mt-1">
            your first Pocket RC drift
          </p>
        </div>

        {/* Body */}
        <div className="p-6">
          <p className="text-sm text-brand-ink text-center">
            Use this code at checkout — or DM us on WhatsApp and we&apos;ll
            apply it for you.
          </p>

          {/* Coupon code box */}
          <button
            type="button"
            onClick={copyCoupon}
            className="mt-4 w-full border-2 border-dashed border-brand-red rounded-xl py-3 px-4 flex items-center justify-between bg-brand-red-soft hover:bg-brand-red/10 transition-colors group"
          >
            <span className="font-display font-bold text-xl tracking-widest text-brand-red">
              {COUPON}
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs font-mono uppercase tracking-widest text-brand-red font-semibold">
              {copied ? (
                <>
                  <Check size={14} /> Copied
                </>
              ) : (
                <>
                  <Copy size={14} /> Copy
                </>
              )}
            </span>
          </button>

          {/* WhatsApp CTA */}
          <a
            href={waLink(
              "Hi! I'd like to use coupon DRIFT100 (₹100 off) on my first Pocket RC car order."
            )}
            target="_blank"
            rel="noopener"
            onClick={() => setOpen(false)}
            className="mt-3 w-full bg-whatsapp-green hover:bg-whatsapp-green-hover text-white py-3 rounded-xl font-bold text-sm inline-flex items-center justify-center gap-2 transition-colors"
          >
            <WhatsAppIcon size={18} />
            Claim on WhatsApp
          </a>

          <button
            type="button"
            onClick={() => setOpen(false)}
            className="mt-3 w-full text-center text-xs text-brand-ink-soft hover:text-brand-ink underline-offset-4 hover:underline"
          >
            No thanks, I&apos;ll pay full price
          </button>
        </div>
      </div>
    </div>
  );
}
