"use client";

import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Read-only star rating with fractional fill (e.g. 4.5 → four-and-a-half gold
 * stars). Renders a grey base row and a gold row clipped to `value/5` width, so
 * any decimal renders precisely without half-star icon assets.
 */
export function Stars({
  value,
  size = 16,
  className,
}: {
  value: number;
  size?: number;
  className?: string;
}) {
  const pct = Math.max(0, Math.min(100, (value / 5) * 100));
  return (
    <span
      className={cn("relative inline-flex shrink-0 align-middle", className)}
      style={{ width: size * 5, height: size }}
      aria-label={`${value} out of 5 stars`}
      role="img"
    >
      <span className="absolute inset-0 flex">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star key={i} size={size} className="text-brand-line" fill="currentColor" strokeWidth={0} />
        ))}
      </span>
      <span className="absolute inset-0 flex overflow-hidden" style={{ width: `${pct}%` }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <Star key={i} size={size} className="text-amber-400" fill="currentColor" strokeWidth={0} />
        ))}
      </span>
    </span>
  );
}

/**
 * Interactive 1–5 star input for the "write a review" form. Fully keyboard-
 * and pointer-accessible; hover previews the rating, click commits it.
 */
export function StarInput({
  value,
  onChange,
  size = 28,
}: {
  value: number;
  onChange: (v: number) => void;
  size?: number;
}) {
  return (
    <div className="inline-flex gap-1" role="radiogroup" aria-label="Your rating">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} star${n > 1 ? "s" : ""}`}
          onClick={() => onChange(n)}
          className="transition-transform hover:scale-110 active:scale-95"
        >
          <Star
            size={size}
            strokeWidth={1.5}
            className={n <= value ? "text-amber-400" : "text-brand-line"}
            fill={n <= value ? "currentColor" : "none"}
          />
        </button>
      ))}
    </div>
  );
}
