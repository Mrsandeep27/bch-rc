"use client";

/**
 * 1:16 "Drifters of India" rail. Same reel content as the 1:64 <UgcGrid /> —
 * it reads the SAME ugc-manifest.json (with the product-image stubs as a
 * fallback), so the 1:16 store shows the same drift reels until 1:16-specific
 * footage is filmed.
 *
 * Playback model (per owner brief): the reels AUTOPLAY and the rail keeps
 * AUTO-SCROLLING continuously — it never freezes on play. To keep bandwidth
 * and CPU sane we only ever play TWO reels at once: the two most-visible cards
 * (tracked by an IntersectionObserver) mount their <video> and autoplay muted;
 * everything else shows just the cheap poster. As the strip drifts, the active
 * pair hands off automatically. Tap a playing reel to unmute it.
 *
 * Framing is scoped to /16: slate accent heading (via the .store-16 token
 * scope), CTA to the 1:16 lineup (#lineup) at the 1:16 price, store16 handle.
 */

import Image from "next/image";
import Link from "next/link";
import { Volume2, VolumeX, ShoppingBag } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { InstagramIcon } from "@/components/BrandIcons";
import { STORE16, formatINR16 } from "@/lib/store16";
import manifestData from "@/lib/ugc-manifest.json";

type UgcCard = {
  src: string;
  handle: string;
  caption: string;
  likes: string;
  isVideo?: boolean;
  url?: string;
  poster?: string;
};

const MANIFEST = manifestData as UgcCard[];

const STUBS: UgcCard[] = [
  { src: "/products/PRC-bmw.webp", handle: "164prccars", caption: "Pocket BMW · drift wheels on", likes: "1.2K" },
  { src: "/products/PRC-porsche.webp", handle: "pocketrccar", caption: "GT3 silhouette in dark blue", likes: "847" },
  { src: "/products/PRC-monster.webp", handle: "164prccars", caption: "Monster Truck climbs anything", likes: "2.4K" },
  { src: "/products/PRC-thar.webp", handle: "pocketrccar", caption: "Thar off-roading on marble", likes: "612" },
  { src: "/products/PRC-f1-classic.webp", handle: "164prccars", caption: "Pocket F1 · race day at home", likes: "1.9K" },
  { src: "/products/PRC-bmw.webp", handle: "pocketrccar", caption: "Behind the scenes · Bangalore HQ", likes: "534" },
];

const SCROLL_SPEED_PX_PER_FRAME = 0.4; // ~24 px/sec
const RESUME_AFTER_INTERACTION_MS = 2500;
const MAX_CONCURRENT_VIDEOS = 2; // play at most two reels at a time

function posterFor(card: UgcCard): string {
  return card.poster ?? card.src.replace(/\.mp4$/i, ".jpg");
}

function ReelCard({
  card,
  isVideo,
  isActive,
  isUnmuted,
  onToggleSound,
  registerRef,
}: {
  card: UgcCard;
  isVideo: boolean;
  isActive: boolean;
  isUnmuted: boolean;
  onToggleSound: () => void;
  registerRef: (el: HTMLElement | null) => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const poster = posterFor(card);
  const href = card.url ?? `https://instagram.com/${card.handle}`;
  const playing = isVideo && isActive;

  useEffect(() => {
    const v = videoRef.current;
    if (!v || !playing) return;
    v.muted = !isUnmuted;
    if (isUnmuted) v.volume = 1;
    const p = v.play();
    if (p && typeof p.catch === "function") p.catch(() => {});
  }, [playing, isUnmuted]);

  return (
    <div
      ref={registerRef}
      className="group snap-center relative shrink-0 w-[34vw] sm:w-[170px] aspect-[9/16] rounded-xl overflow-hidden bg-brand-ink border border-brand-line"
    >
      {/* Poster — always shown (cheap). Video paints over it once active. */}
      <Image
        src={poster}
        alt={`@${card.handle} · ${card.caption}`}
        fill
        sizes="(max-width: 640px) 34vw, 170px"
        className="object-cover"
      />

      {/* Video — mounted ONLY while this card is one of the active pair. */}
      {playing && (
        <video
          ref={videoRef}
          src={card.src}
          poster={poster}
          loop
          playsInline
          autoPlay
          muted={!isUnmuted}
          preload="auto"
          className="absolute inset-0 w-full h-full object-cover transform-gpu z-[5]"
        />
      )}

      <div className="absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b from-black/70 to-transparent pointer-events-none z-20" />
      <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/90 via-black/40 to-transparent pointer-events-none z-20" />

      {/* Tap layer:
          - playing video → tap toggles sound
          - everything else → tap opens Instagram */}
      {playing ? (
        <button
          type="button"
          onClick={onToggleSound}
          aria-label={isUnmuted ? "Mute reel" : "Unmute reel"}
          className="absolute inset-0 z-10"
        />
      ) : (
        <a
          href={href}
          target="_blank"
          rel="noopener"
          aria-label={`Open @${card.handle} on Instagram`}
          className="absolute inset-0 z-10"
        />
      )}

      {/* Handle chip → Instagram. */}
      <a
        href={href}
        target="_blank"
        rel="noopener"
        onClick={(e) => e.stopPropagation()}
        className="absolute top-2.5 left-2.5 z-30 flex items-center gap-1 bg-black/60 backdrop-blur-sm text-white text-[10px] font-mono uppercase tracking-widest px-2 py-1 rounded-full hover:bg-black/80"
      >
        <InstagramIcon size={10} />
        <span className="truncate max-w-[110px]">@{card.handle}</span>
      </a>

      {/* Sound toggle — only while playing (autoplay starts muted). */}
      {playing && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onToggleSound();
          }}
          aria-label={isUnmuted ? "Mute reel" : "Unmute reel"}
          className="absolute top-2.5 right-2.5 z-30 w-8 h-8 rounded-full bg-black/60 backdrop-blur-sm border border-white/20 flex items-center justify-center text-white hover:bg-black/80 active:scale-95 transition"
        >
          {isUnmuted ? <Volume2 size={14} /> : <VolumeX size={14} />}
        </button>
      )}

      <div className="absolute inset-x-0 bottom-0 p-3 text-white z-20 pointer-events-none">
        <p className="text-xs font-semibold leading-tight line-clamp-2">
          {card.caption}
        </p>
      </div>
    </div>
  );
}

export default function UgcGrid16() {
  const UGC = useMemo(() => {
    const source = MANIFEST.length >= 6 ? MANIFEST : STUBS;
    const seen = new Set<string>();
    return source
      .filter((c) => {
        const key = c.url ?? c.caption;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 12);
  }, []);

  const cards = useMemo(() => [...UGC, ...UGC], [UGC]);
  const trackRef = useRef<HTMLDivElement>(null);

  // The (up to two) render-indices whose videos are mounted + autoplaying.
  const [activeKeys, setActiveKeys] = useState<number[]>([]);
  // Which active card, if any, the viewer has unmuted (only one at a time).
  const [unmutedKey, setUnmutedKey] = useState<number | null>(null);

  // index → DOM node, and index → current visibility ratio.
  const nodesRef = useRef<Map<number, HTMLElement>>(new Map());
  const ratiosRef = useRef<Map<number, number>>(new Map());

  const isVideoCard = useCallback(
    (i: number) => {
      const c = cards[i];
      return c.isVideo ?? c.src.toLowerCase().endsWith(".mp4");
    },
    [cards]
  );

  // Recompute the two most-visible video cards from the latest ratios.
  const recomputeActive = useCallback(() => {
    const ranked = [...ratiosRef.current.entries()]
      .filter(([i, ratio]) => ratio > 0.1 && isVideoCard(i))
      .sort((a, b) => b[1] - a[1])
      .slice(0, MAX_CONCURRENT_VIDEOS)
      .map(([i]) => i)
      .sort((a, b) => a - b);

    setActiveKeys((prev) =>
      prev.length === ranked.length && prev.every((v, k) => v === ranked[k])
        ? prev
        : ranked
    );
  }, [isVideoCard]);

  // Observe each card's intersection with the scroll viewport.
  useEffect(() => {
    const root = trackRef.current;
    if (!root) return;

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const idx = Number((e.target as HTMLElement).dataset.idx);
          ratiosRef.current.set(idx, e.intersectionRatio);
        }
        recomputeActive();
      },
      { root, threshold: [0, 0.25, 0.5, 0.75, 1] }
    );

    nodesRef.current.forEach((node) => io.observe(node));
    return () => io.disconnect();
  }, [cards, recomputeActive]);

  // Drop the unmuted flag if that card scrolled out of the active pair.
  useEffect(() => {
    if (unmutedKey !== null && !activeKeys.includes(unmutedKey)) {
      setUnmutedKey(null);
    }
  }, [activeKeys, unmutedKey]);

  // Continuous auto-scroll — never freezes (playback is capped, not paused).
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    let raf = 0;
    let paused = false;
    let resumeAt = 0;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    let reduced = mq.matches;
    const onMq = (e: MediaQueryListEvent) => (reduced = e.matches);
    mq.addEventListener("change", onMq);

    const tick = (now: number) => {
      if (paused && resumeAt > 0 && now >= resumeAt) {
        paused = false;
        resumeAt = 0;
      }
      if (!reduced && !paused) {
        track.scrollLeft += SCROLL_SPEED_PX_PER_FRAME;
        const half = track.scrollWidth / 2;
        if (half > 0 && track.scrollLeft >= half) track.scrollLeft -= half;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    const pauseTemporarily = () => {
      paused = true;
      resumeAt = performance.now() + RESUME_AFTER_INTERACTION_MS;
    };
    const pauseHover = () => {
      paused = true;
      resumeAt = 0;
    };
    const resume = () => {
      paused = false;
      resumeAt = 0;
    };

    track.addEventListener("touchstart", pauseTemporarily, { passive: true });
    track.addEventListener("touchmove", pauseTemporarily, { passive: true });
    track.addEventListener("wheel", pauseTemporarily, { passive: true });
    track.addEventListener("mouseenter", pauseHover);
    track.addEventListener("mouseleave", resume);

    return () => {
      cancelAnimationFrame(raf);
      mq.removeEventListener("change", onMq);
      track.removeEventListener("touchstart", pauseTemporarily);
      track.removeEventListener("touchmove", pauseTemporarily);
      track.removeEventListener("wheel", pauseTemporarily);
      track.removeEventListener("mouseenter", pauseHover);
      track.removeEventListener("mouseleave", resume);
    };
  }, []);

  return (
    <section className="py-4 sm:py-6 bg-white" aria-label="Drifters of India">
      <div className="max-w-6xl mx-auto px-4">
        <div className="text-center">
          <p className="text-[10px] sm:text-xs font-mono font-bold uppercase tracking-widest text-brand-red">
            Drifters of India
          </p>
          <h2 className="font-display text-2xl sm:text-3xl font-bold text-brand-ink mt-1 text-balance">
            Real cars. Real homes. Real drifts.
          </h2>
          <p className="hidden sm:block text-brand-ink-soft mt-1.5 text-sm sm:text-base">
            Tag{" "}
            <a
              href={`https://instagram.com/${STORE16.instagramHandle}`}
              target="_blank"
              rel="noopener"
              className="text-brand-red font-semibold hover:underline"
            >
              @{STORE16.instagramHandle}
            </a>{" "}
            to get featured. Reels play on their own — tap to unmute.
          </p>
        </div>

        <div
          ref={trackRef}
          className="mt-5 -mx-4 sm:-mx-0 overflow-x-auto overflow-y-hidden no-scrollbar touch-pan-x"
        >
          <div className="flex gap-3 sm:gap-4 px-4 w-max">
            {cards.map((card, i) => {
              const isVideo = isVideoCard(i);
              return (
                <ReelCard
                  key={`${card.handle}-${i}`}
                  card={card}
                  isVideo={isVideo}
                  isActive={activeKeys.includes(i)}
                  isUnmuted={unmutedKey === i}
                  onToggleSound={() =>
                    setUnmutedKey((cur) => (cur === i ? null : i))
                  }
                  registerRef={(el) => {
                    if (el) {
                      el.dataset.idx = String(i);
                      nodesRef.current.set(i, el);
                    } else {
                      nodesRef.current.delete(i);
                    }
                  }}
                />
              );
            })}
          </div>
        </div>

        <div className="mt-5 text-center flex flex-col items-center gap-2.5">
          <Link
            href="#lineup"
            className="cta-slice inline-flex items-center gap-2 px-6 py-3 rounded-full text-sm font-semibold"
          >
            <ShoppingBag size={16} />
            Pick your drift — from {formatINR16(2899)}, COD
          </Link>
          <Link
            href={`https://instagram.com/${STORE16.instagramHandle}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-brand-ink-soft hover:text-brand-ink"
          >
            <InstagramIcon size={14} />
            Or follow @{STORE16.instagramHandle} for new drops
          </Link>
        </div>
      </div>
    </section>
  );
}
