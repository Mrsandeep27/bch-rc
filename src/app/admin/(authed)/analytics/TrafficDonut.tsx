"use client";

/**
 * Traffic-source donut. Inline SVG (no chart dependency): each slice is a
 * circle with a stroke-dasharray arc, rotated by the running offset. Hovering a
 * slice or a legend row highlights both and shows the share.
 */

import { useState } from "react";
import { formatINR } from "@/lib/utils";

export type Slice = { label: string; value: number; revenue: number };

/** Semantic-neutral categorical ramp, tuned for the warm light admin ground. */
const COLORS = ["#e11d2a", "#16a34a", "#d4a017", "#3a4ac0", "#8a5cf6", "#0e9aa7"];

const R = 60;
const C = 2 * Math.PI * R;

export default function TrafficDonut({
  slices,
  totalLabel = "sessions",
}: {
  slices: Slice[];
  totalLabel?: string;
}) {
  const [active, setActive] = useState<number | null>(null);
  const total = slices.reduce((a, s) => a + s.value, 0);

  if (total === 0) {
    return (
      <div className="rounded-2xl border border-brand-line bg-white">
        <div className="border-b border-brand-line px-4 sm:px-5 py-3.5">
          <h2 className="font-semibold text-brand-ink">Traffic sources</h2>
        </div>
        <p className="px-5 py-10 sm:py-14 text-center text-sm text-brand-ink-soft">
          No attributed traffic yet.
        </p>
      </div>
    );
  }

  let offset = 0;
  const arcs = slices.map((s, i) => {
    const frac = s.value / total;
    const arc = { s, i, frac, dash: frac * C, offset };
    offset += frac * C;
    return arc;
  });

  const shown = active !== null ? slices[active] : null;

  return (
    <div className="rounded-2xl border border-brand-line bg-white overflow-hidden">
      <div className="border-b border-brand-line px-4 sm:px-5 py-3.5">
        <h2 className="font-semibold text-brand-ink">Traffic sources</h2>
        <p className="text-xs text-brand-ink-soft mt-0.5">Where paid orders came from</p>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-4 p-3 sm:gap-5 sm:p-5">
        <div className="relative shrink-0">
          <svg viewBox="0 0 160 160" width="150" height="150" className="w-[132px] h-[132px] sm:w-[150px] sm:h-[150px]" role="img" aria-label="Traffic sources">
            <g transform="rotate(-90 80 80)">
              {arcs.map(({ s, i, dash, offset: o }) => (
                <circle
                  key={s.label}
                  cx="80"
                  cy="80"
                  r={R}
                  fill="none"
                  stroke={COLORS[i % COLORS.length]}
                  strokeWidth={active === i ? 26 : 20}
                  strokeDasharray={`${dash} ${C - dash}`}
                  strokeDashoffset={-o}
                  className="cursor-pointer transition-[stroke-width]"
                  onMouseEnter={() => setActive(i)}
                  onMouseLeave={() => setActive(null)}
                />
              ))}
            </g>
          </svg>
          <div className="absolute inset-0 grid place-items-center pointer-events-none">
            <div className="text-center">
              <div className="text-lg font-bold tabular-nums text-brand-ink">
                {shown ? `${Math.round((shown.value / total) * 100)}%` : total.toLocaleString("en-IN")}
              </div>
              <div className="text-[10px] uppercase tracking-wide text-brand-ink-soft">
                {shown ? shown.label : totalLabel}
              </div>
            </div>
          </div>
        </div>

        <ul className="w-full space-y-1.5">
          {slices.map((s, i) => (
            <li
              key={s.label}
              onMouseEnter={() => setActive(i)}
              onMouseLeave={() => setActive(null)}
              className={`flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm transition-colors ${
                active === i ? "bg-brand-cream" : ""
              }`}
            >
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ background: COLORS[i % COLORS.length] }}
              />
              <span className="flex-1 truncate text-brand-ink">{s.label}</span>
              <span className="tabular-nums text-brand-ink-soft text-xs">
                {formatINR(s.revenue)}
              </span>
              <span className="w-9 text-right tabular-nums font-semibold text-brand-ink">
                {Math.round((s.value / total) * 100)}%
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
