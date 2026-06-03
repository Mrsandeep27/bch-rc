"use client";

import { useEffect } from "react";
import Link from "next/link";

/**
 * Root error boundary. Catches any unhandled error in a client component
 * below /app. Logs to console (forwarded to Sentry once installed) and shows
 * a recovery screen with a hard-reload button + WhatsApp support link.
 */
export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app:error]", error.message, error.digest);
  }, [error]);

  return (
    <main className="min-h-[100svh] flex items-center justify-center bg-brand-cream px-6">
      <div className="max-w-md text-center">
        <p className="font-mono text-xs uppercase tracking-widest text-brand-red">
          Something stalled
        </p>
        <h1 className="font-display text-3xl sm:text-4xl font-bold text-brand-ink mt-2">
          We hit a bump.
        </h1>
        <p className="text-brand-ink-soft mt-3 leading-relaxed">
          Tap try again, or go home and start over. If you had an order in
          progress, WhatsApp <a className="text-brand-red font-semibold" href="https://wa.me/916362346498">+91 63623 46498</a> with your card's last 4 digits — we never charge twice.
        </p>
        <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
          <button
            type="button"
            onClick={reset}
            className="bg-brand-red hover:bg-brand-red-hover text-white px-6 py-3 rounded-full font-semibold"
          >
            Try again
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
