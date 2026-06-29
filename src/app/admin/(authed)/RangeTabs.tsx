"use client";

import { useRouter, useSearchParams } from "next/navigation";

const RANGES = [
  { d: 7, label: "7 days" },
  { d: 14, label: "14 days" },
  { d: 30, label: "30 days" },
] as const;

/**
 * Time-window selector for the Overview dashboard. Mirrors FunnelWindowTabs:
 * client-side so the active pill flips instantly off ?range=N, and router.push
 * re-fetches the dynamic page so every period-scoped metric + the sales graph
 * recompute for the chosen window. "Today" and "Live now" are real-time and
 * deliberately stay outside this control.
 */
export function RangeTabs() {
  const router = useRouter();
  const sp = useSearchParams();
  const current = Number(sp.get("range")) || 7;

  function go(days: number) {
    // Preserve any other params (notably ?site=) so the store + range toggles
    // compose instead of clobbering each other.
    const params = new URLSearchParams(sp.toString());
    params.set("range", String(days));
    router.push(`/admin?${params.toString()}`);
  }

  return (
    <div className="flex gap-1 bg-brand-cream rounded-full p-1 shrink-0">
      {RANGES.map((r) => (
        <button
          key={r.d}
          type="button"
          onClick={() => go(r.d)}
          aria-pressed={current === r.d}
          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
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
