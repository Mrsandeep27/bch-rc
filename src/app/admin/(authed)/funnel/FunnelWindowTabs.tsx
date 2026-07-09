"use client";

import { useRouter, useSearchParams } from "next/navigation";

const WINDOWS = [
  { d: 1, label: "24h" },
  { d: 7, label: "7 days" },
  { d: 30, label: "30 days" },
] as const;

/**
 * Time-window selector for the funnel dashboard. Client-side so the active
 * state flips instantly off the URL (?window=N) via useSearchParams, and
 * router.push re-fetches the dynamic page for fresh data. Replaces the plain
 * <Link> tabs, whose searchParams-only navigation didn't reliably re-render.
 */
export function FunnelWindowTabs() {
  const router = useRouter();
  const sp = useSearchParams();
  const current = Number(sp.get("window")) || 7;

  function go(days: number) {
    router.push(`/admin/funnel?window=${days}`);
  }

  return (
    <div className="flex gap-1 bg-brand-cream rounded-full p-1">
      {WINDOWS.map((w) => (
        <button
          key={w.d}
          type="button"
          onClick={() => go(w.d)}
          aria-pressed={current === w.d}
          className={`px-3 py-2 sm:py-1.5 rounded-full text-sm font-medium transition-colors ${
            current === w.d
              ? "bg-brand-ink text-white"
              : "text-brand-ink-soft hover:text-brand-ink"
          }`}
        >
          {w.label}
        </button>
      ))}
    </div>
  );
}
