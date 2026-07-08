"use client";

import { useEffect } from "react";

export const AUTOROLL_MS = 3500;

/**
 * Auto-advance a snap-scroll rail every AUTOROLL_MS: pauses while touched /
 * hovered, disabled for reduced-motion. Same behaviour as the hub hero.
 */
export function useAutoRoll(ref: { current: HTMLDivElement | null }, count: number) {
  useEffect(() => {
    const rail = ref.current;
    if (!rail || count < 2) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    let paused = false;
    const pause = () => (paused = true);
    const resume = () => (paused = false);
    const evPause = ["pointerdown", "mouseenter", "touchstart"] as const;
    const evResume = ["pointerup", "pointercancel", "mouseleave", "touchend"] as const;
    evPause.forEach((e) => rail.addEventListener(e, pause, { passive: true }));
    evResume.forEach((e) => rail.addEventListener(e, resume, { passive: true }));

    const id = setInterval(() => {
      if (paused) return;
      const w = rail.clientWidth;
      if (!w) return; // hidden carousel
      const cur = Math.round(rail.scrollLeft / w);
      rail.scrollTo({ left: ((cur + 1) % count) * w, behavior: "smooth" });
    }, AUTOROLL_MS);

    return () => {
      clearInterval(id);
      evPause.forEach((e) => rail.removeEventListener(e, pause));
      evResume.forEach((e) => rail.removeEventListener(e, resume));
    };
  }, [ref, count]);
}
