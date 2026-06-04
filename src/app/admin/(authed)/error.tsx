"use client";

import { useEffect } from "react";

/**
 * PHASE 5 — Admin-segment error boundary.
 *
 * Catches errors thrown while rendering anything under /admin/(authed),
 * including a DatabaseUnavailableError bubbling up from requireAdmin() when
 * the admins lookup fails during a database outage.
 *
 * Deliberate behaviour:
 *  - Shows a clear, calm "temporarily unavailable" message — NOT the generic
 *    "We hit a bump" root screen.
 *  - Never exposes the error message or stack trace to the user.
 *  - Offers an in-place "Try again" (reset) — it does NOT redirect to
 *    /admin/login, so a transient DB blip can't masquerade as a logout, and a
 *    real admin is never incorrectly treated as unauthorized.
 */
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log only the digest/name — no PII, no stack to the client console.
    console.error("[admin:error]", error.name, error.digest);
  }, [error]);

  return (
    <main className="min-h-[60vh] flex items-center justify-center px-6">
      <div className="max-w-md text-center">
        <p className="font-mono text-xs uppercase tracking-widest text-brand-red">
          Temporarily unavailable
        </p>
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-brand-ink mt-2">
          Admin service is temporarily unavailable.
        </h1>
        <p className="text-brand-ink-soft mt-3 leading-relaxed">
          Please try again in a few minutes. Your session is still active — you
          have not been signed out.
        </p>
        <div className="mt-6 flex justify-center">
          <button
            type="button"
            onClick={reset}
            className="bg-brand-ink hover:bg-brand-ink-soft text-white px-6 py-3 rounded-full font-semibold transition-colors"
          >
            Try again
          </button>
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
