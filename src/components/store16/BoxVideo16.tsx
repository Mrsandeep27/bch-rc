"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Play, X } from "lucide-react";

/**
 * 1:16 PDP product video — Flipkart-style.
 *
 * Renders as the FIRST media tile in the PDP gallery strip: a poster image with
 * a play badge. Tapping it opens a fullscreen, portrait (9:16) player with an X
 * to close. Built for low cost + fast load:
 *   • The <video> element is only mounted while the player is OPEN, so nothing
 *     downloads until the buyer actually taps play (`preload="metadata"` then).
 *   • Until then only the small poster JPG is on the page (lazy via next/image).
 *   • Works on desktop and mobile: object-contain keeps the vertical video fully
 *     visible, capped to the viewport; Esc / backdrop tap / X all close it, and
 *     body scroll is locked while open.
 */
export default function BoxVideo16({
  src,
  poster,
  name,
}: {
  src: string;
  poster: string;
  name: string;
}) {
  const [open, setOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const close = useCallback(() => setOpen(false), []);

  // While the player is open: lock body scroll and wire Esc-to-close. Pausing
  // happens for free because the <video> unmounts when `open` flips to false.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, close]);

  return (
    <>
      {/* ── First gallery tile: poster + play badge ─────────────────────── */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Play ${name} video`}
        className="group relative aspect-square overflow-hidden rounded-lg border-2 border-brand-line bg-black transition-colors hover:border-brand-red"
      >
        <Image
          src={poster}
          alt=""
          fill
          loading="lazy"
          sizes="120px"
          className="object-cover opacity-90 transition-opacity group-hover:opacity-100"
        />
        <span className="absolute inset-0 grid place-items-center">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-white/90 text-brand-red shadow-md transition-transform group-hover:scale-110">
            <Play className="h-4 w-4 translate-x-[1px] fill-current" />
          </span>
        </span>
        <span className="absolute bottom-1 left-0 right-0 text-center font-mono text-[8px] font-semibold uppercase tracking-widest text-white/90 [text-shadow:0_1px_4px_rgba(0,0,0,0.8)]">
          Video
        </span>
      </button>

      {/* ── Fullscreen portrait player ──────────────────────────────────── */}
      {open && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/92 backdrop-blur-sm"
          onClick={close}
          role="dialog"
          aria-modal="true"
          aria-label={`${name} video`}
        >
          <button
            type="button"
            onClick={close}
            aria-label="Close video"
            className="absolute right-4 top-4 z-10 grid h-11 w-11 place-items-center rounded-full bg-white/15 text-white backdrop-blur transition-colors hover:bg-white/30"
            style={{ top: "max(1rem, env(safe-area-inset-top))" }}
          >
            <X className="h-6 w-6" />
          </button>

          {/* stop propagation so taps on the video don't close the overlay */}
          <video
            ref={videoRef}
            src={src}
            poster={poster}
            controls
            autoPlay
            playsInline
            preload="metadata"
            onClick={(e) => e.stopPropagation()}
            className="h-auto max-h-[92vh] w-auto max-w-[94vw] rounded-xl bg-black shadow-2xl"
          />
        </div>
      )}
    </>
  );
}
