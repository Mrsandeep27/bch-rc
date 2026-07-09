"use client";

import { useRouter, useSearchParams } from "next/navigation";

const RANGES = [
  { d: 1, label: "Today" },
  { d: 7, label: "7 days" },
  { d: 14, label: "14 days" },
  { d: 30, label: "30 days" },
] as const;

/** Default window when no ?range= is present. Must match ALLOWED_RANGES/default
 *  in the dashboard page, or the active pill and the data would disagree. */
const DEFAULT_RANGE = 1;

/**
 * Time-window selector for the Overview dashboard. Mirrors FunnelWindowTabs:
 * client-side so the active pill flips instantly off ?range=N, and router.push
 * re-fetches the dynamic page so every period-scoped metric + the sales graph
 * recompute for the chosen window. "Today" is the default. "Live now" stays
 * outside this control — it's real-time, not windowed.
 */
export function RangeTabs() {
  const router = useRouter();
  const sp = useSearchParams();
  const current = Number(sp.get("range")) || DEFAULT_RANGE;

  function go(days: number) {
    const params = new URLSearchParams(sp.toString());
    if (days === DEFAULT_RANGE) params.delete("range");
    else params.set("range", String(days));
    const qs = params.toString();
    router.push(qs ? `/admin?${qs}` : "/admin");
  }

  return (
    <div className="flex gap-1 bg-brand-cream rounded-full p-1 shrink-0">
      {RANGES.map((r) => (
        <button
          key={r.d}
          type="button"
          onClick={() => go(r.d)}
          aria-pressed={current === r.d}
          className={`px-2.5 sm:px-3 py-2 sm:py-1.5 rounded-full text-sm font-medium transition-colors ${
            current === r.d
              ? "bg-brand-ink text-white"
              : "text-brand-ink-soft hover:text-brand-ink"
          }`}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}
