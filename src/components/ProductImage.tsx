"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import type { Sku } from "@/lib/products";
import { ProductPlaceholder } from "@/components/ProductPlaceholder";

/**
 * Renders the product hero image with a graceful fallback.
 * If the SKU has a heroVideo, the video plays on hover (desktop) or tap
 * (mobile) — muted, looped, web-optimized H.264. Image stays as the poster.
 * If the image fails to load, the colored ProductPlaceholder SVG shows.
 *
 * Earlier we tried an Aritzia-style lazy-load (preload=none + JS src injection
 * + IntersectionObserver) but it caused first-hover playback to stutter while
 * the browser fetched and parsed the file. Reverted to this simpler pattern
 * where the browser preloads metadata so playback starts cleanly.
 */
export function ProductImage({
  sku,
  className,
}: {
  sku: Sku;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const [playing, setPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  if (!sku.heroImage || failed) {
    return (
      <ProductPlaceholder sku={sku} showLabel={false} className={className} />
    );
  }

  const startVideo = () => {
    if (!sku.heroVideo || !videoRef.current) return;
    videoRef.current.currentTime = 0;
    videoRef.current
      .play()
      .then(() => setPlaying(true))
      .catch(() => {});
  };

  const stopVideo = () => {
    if (!sku.heroVideo || !videoRef.current) return;
    videoRef.current.pause();
    setPlaying(false);
  };

  return (
    <div
      className={`relative w-full h-full bg-brand-cream ${className ?? ""}`}
      onMouseEnter={startVideo}
      onMouseLeave={stopVideo}
      onTouchStart={startVideo}
      onTouchEnd={stopVideo}
    >
      {/* Static image — always rendered, fades out when video plays.
          The parent's `bg-brand-cream` is the load-state backdrop; we no
          longer render a coloured SVG car silhouette behind the image
          because it flashed for ~1s before the real photo arrived. The
          `onError` fallback above still swaps to the ProductPlaceholder
          if the image fails to load entirely. */}
      <Image
        src={sku.heroImage}
        alt={sku.name}
        fill
        sizes="(max-width: 768px) 85vw, (max-width: 1280px) 50vw, 25vw"
        quality={90}
        className={`object-contain object-center transition-opacity duration-300 ${
          playing ? "opacity-0" : "opacity-100"
        }`}
        onError={() => setFailed(true)}
      />

      {/* Hover video — preloads metadata so first hover plays cleanly.
          transform-gpu forces a compositor layer so Chrome uses hardware video
          decode from the start (without it, decode runs on CPU/software path
          and looks blurry until a repaint promotes it — eg. scrolling). */}
      {sku.heroVideo && (
        <video
          ref={videoRef}
          src={sku.heroVideo}
          muted
          loop
          playsInline
          preload="metadata"
          className={`absolute inset-0 w-full h-full object-cover transform-gpu will-change-transform transition-opacity duration-300 ${
            playing ? "opacity-100" : "opacity-0"
          }`}
        />
      )}

      {/* Tiny play-indicator dot — desktop only ("Hover" makes no sense on
          mobile where there's no hover event; tap-to-play is implicit). */}
      {sku.heroVideo && !playing && (
        <span
          aria-hidden
          className="hidden sm:flex absolute bottom-2 right-2 z-10 items-center gap-1 px-2 py-0.5 rounded-full bg-black/70 backdrop-blur-sm"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-brand-red animate-pulse" />
          <span className="text-[9px] font-mono uppercase tracking-wider text-white/90">
            Hover
          </span>
        </span>
      )}
    </div>
  );
}
