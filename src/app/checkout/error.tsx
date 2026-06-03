"use client";

import { useEffect } from "react";
import Link from "next/link";

/**
 * Checkout-specific error boundary. Critical message: payment may have
 * succeeded even if the screen errored. Customer must NOT retry-pay before
 * confirming. WhatsApp + last-4 is the recovery path.
 */
export default function CheckoutError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[checkout:error]", error.message, error.digest);
  }, [error]);

  return (
    <main className="min-h-[100svh] flex items-center justify-center bg-brand-cream px-6">
      <div className="max-w-md text-center">
        <p className="font-mono text-xs uppercase tracking-widest text-brand-red">
          Checkout error
        </p>
        <h1 className="font-display text-3xl sm:text-4xl font-bold text-brand-ink mt-2">
          Don't pay again — read this first.
        </h1>
        <div className="text-left mt-5 bg-white rounded-2xl p-5 border border-brand-line">
          <p className="text-sm text-brand-ink">
            <b>If your bank already debited you</b>, your order may have gone
            through. Check your inbox for an order confirmation from
            orders@pocketrccars.com (search "PRC Cars").
          </p>
          <p className="text-sm text-brand-ink mt-3">
            <b>If unsure</b>, WhatsApp{" "}
            <a
              className="text-brand-red font-semibold"
              href="https://wa.me/916362346498"
            >
              +91 63623 46498
            </a>{" "}
            with your card's last 4 digits — we never charge twice.
          </p>
        </div>
        <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
          <button
            type="button"
            onClick={reset}
            className="bg-brand-red hover:bg-brand-red-hover text-white px-6 py-3 rounded-full font-semibold"
          >
            Try checkout again
          </button>
          <Link
            href="/"
            className="border border-brand-line px-6 py-3 rounded-full font-semibold text-brand-ink"
          >
            Go home
          </Link>
        </div>
        {error.digest && (
          <p className="mt-6 text-[10px] font-mono text-brand-ink-soft">
            ref: {error.digest}
          </p>
        )}
      </div>
    </main>
  );
}
