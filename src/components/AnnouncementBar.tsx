"use client";

import { useEffect, useState } from "react";
import { ANNOUNCEMENTS } from "@/lib/copy";

const CYCLE_MS = 7000; // was 4500 — too fast to finish reading long messages

export function AnnouncementBar() {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;

    // Honour OS-level "reduce motion" preference — pin to the first
    // announcement instead of rotating. Users who set this typically can't
    // process fast text-change cycles.
    const mq =
      typeof window !== "undefined"
        ? window.matchMedia("(prefers-reduced-motion: reduce)")
        : null;
    if (mq?.matches) {
      setIndex(0);
      return;
    }

    const id = setInterval(
      () => setIndex((i) => (i + 1) % ANNOUNCEMENTS.length),
      CYCLE_MS,
    );
    return () => clearInterval(id);
  }, [paused]);

  const current = ANNOUNCEMENTS[index];

  const body = (
    <span
      key={index}
      className="animate-fade-in-up flex items-center gap-1.5 sm:gap-2"
    >
      {current.emoji && <span aria-hidden>{current.emoji}</span>}
      {current.tag && (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-white/20 text-[10px] font-bold tracking-wider uppercase">
          {current.tag}
        </span>
      )}
      <span className="truncate">{current.text}</span>
      {current.href && (
        <span aria-hidden className="ml-1 font-bold">
          →
        </span>
      )}
    </span>
  );

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
      <div className="mx-auto max-w-7xl px-4 h-8 flex items-center justify-center text-center">
        {current.href ? (
          <a
            href={current.href}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline underline-offset-4 inline-flex items-center"
          >
            {body}
          </a>
        ) : (
          body
        )}
      </div>
    </div>
  );
}
