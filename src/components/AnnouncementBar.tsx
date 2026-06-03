"use client";

import { useEffect, useState } from "react";
import { ANNOUNCEMENTS } from "@/lib/copy";
import { AUTO_COUPON } from "@/lib/config";

const CYCLE_MS = 7000; // was 4500 — too fast to finish reading long messages

// The coupon offer is PINNED (always visible), never part of the rotation, so
// no buyer can miss the code. Everything else rotates beside it.
const ROTATING = ANNOUNCEMENTS.filter((a) => a.tag !== "CODE");

export function AnnouncementBar() {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused || ROTATING.length <= 1) return;

    // Honour OS-level "reduce motion" preference — don't rotate at all (the
    // pinned coupon is always visible regardless). Users who set this typically
    // can't process fast text-change cycles.
    const mq =
      typeof window !== "undefined"
        ? window.matchMedia("(prefers-reduced-motion: reduce)")
        : null;
    if (mq?.matches) return;

    const id = setInterval(
      () => setIndex((i) => (i + 1) % ROTATING.length),
      CYCLE_MS,
    );
    return () => clearInterval(id);
  }, [paused]);

  const current = ROTATING[index];

  return (
    <div
      role="status"
      aria-live="polite"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className="sticky top-0 z-50 bg-brand-red text-white text-[12px] sm:text-[13px] font-medium tracking-wide"
    >
      <div className="mx-auto max-w-7xl px-4 h-8 flex items-center justify-center gap-2 text-center">
        {/* Pinned coupon — permanently visible, copy-on-tap. */}
        <span className="inline-flex items-center gap-1.5 shrink-0 font-semibold">
          <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-white/20 text-[10px] font-bold tracking-wider uppercase">
            {AUTO_COUPON.code}
          </span>
          <span className="truncate">{AUTO_COUPON.label}</span>
        </span>

        {/* Rotating secondary messages — hidden on the smallest screens so the
            coupon never gets crowded out. */}
        {current && (
          <span className="hidden sm:inline-flex items-center gap-1.5 text-white/90 border-l border-white/30 pl-2">
            {current.emoji && <span aria-hidden>{current.emoji}</span>}
            <span className="truncate">{current.text}</span>
          </span>
        )}
      </div>
    </div>
  );
}
