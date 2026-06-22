"use client";

import Image from "next/image";
import Link from "next/link";
import { Play, Volume2, VolumeX, ShoppingBag } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { InstagramIcon } from "@/components/BrandIcons";
import { THEME } from "@/lib/theme";
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

function posterFor(card: UgcCard): string {
  return card.poster ?? card.src.replace(/\.mp4$/i, ".jpg");
}

/**
 * One reel card. KEY BANDWIDTH RULE: the <video> element is only mounted once
 * the card is tapped (isPlaying). Until then we render just the poster image,
 * so an un-tapped reel downloads ~0 video bytes (was ~2-3 MB each on autoplay).
 */
function ReelCard({
  card,
  isVideo,
  isPlaying,
  isUnmuted,
  onPlay,
  onToggleSound,
}: {
  card: UgcCard;
  isVideo: boolean;
  isPlaying: boolean;
  isUnmuted: boolean;
  onPlay: () => void;
  onToggleSound: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const poster = posterFor(card);
  const href = card.url ?? `https://instagram.com/${card.handle}`;

  useEffect(() => {
    const v = videoRef.current;
    if (!v || !isPlaying) return;
    v.muted = !isUnmuted;
    if (isUnmuted) v.volume = 1;
    const p = v.play();
    if (p && typeof p.catch === "function") p.catch(() => {});
  }, [isPlaying, isUnmuted]);

  return (
    <div className="group snap-center relative shrink-0 w-[180px] sm:w-[200px] aspect-[9/16] rounded-xl overflow-hidden bg-brand-ink border border-brand-line">
      {/* Poster — always shown (cheap). Video paints over it once playing. */}
      <Image
        src={poster}
        alt={`@${card.handle} · ${card.caption}`}
        fill
        sizes="200px"
        className="object-cover"
      />

      {/* Video — mounted ONLY after tap, so it only downloads on engagement. */}
      {isVideo && isPlaying && (
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
          - video cards  → tap toggles play (loads the video on first tap)
          - image stubs  → tap opens Instagram */}
      {isVideo ? (
        <button
          type="button"
          onClick={onPlay}
          aria-label={isPlaying ? "Pause reel" : "Play reel"}
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

      {/* Play button overlay — shown until the reel is playing. */}
      {isVideo && !isPlaying && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
          <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm border border-white/40 flex items-center justify-center group-hover:scale-110 transition-transform">
            <Play size={18} className="fill-white text-white translate-x-0.5" />
          </div>
        </div>
      )}

      {/* Handle chip → Instagram (stops the tap from toggling play). */}
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

      {/* Sound toggle — only while playing. */}
      {isVideo && isPlaying && (
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

export default function UgcGrid() {
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

  // Two copies for a seamless auto-scroll loop. playingKey is the render-index
  // (0..2N-1) of the one card whose video is mounted — only that card plays.
  const cards = useMemo(() => [...UGC, ...UGC], [UGC]);
  const trackRef = useRef<HTMLDivElement>(null);
  const [playingKey, setPlayingKey] = useState<number | null>(null);
  const [unmuted, setUnmuted] = useState(false);

  // Keep the latest "is a video playing" in a ref so the rAF loop can read it
  // without the effect re-subscribing on every play toggle.
  const playingRef = useRef(false);
  playingRef.current = playingKey !== null;

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
      // Auto-scroll continuously, but freeze while a reel is playing so the
      // viewer can watch it, and while the user is interacting.
      if (!reduced && !paused && !playingRef.current) {
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
    <section className="py-8 sm:py-14 bg-white" aria-label="Drifters of India">
      <div className="max-w-6xl mx-auto px-4">
        <div className="text-center">
          <p className="text-xs font-mono font-bold uppercase tracking-widest text-brand-red">
            Drifters of India
          </p>
          <h2 className="text-3xl sm:text-4xl font-bold text-brand-ink mt-1 text-balance">
            Real cars. Real homes. Real drifts.
          </h2>
          <p className="text-brand-ink-soft mt-2 text-sm sm:text-base">
            Tag{" "}
            <a
              href={`https://instagram.com/${THEME.instagramHandle}`}
              target="_blank"
              rel="noopener"
              className="text-brand-red font-semibold hover:underline"
            >
              @{THEME.instagramHandle}
            </a>{" "}
            to get featured. Tap a reel to play.
          </p>
        </div>

        <div
          ref={trackRef}
          className="mt-8 -mx-4 sm:-mx-0 overflow-x-auto overflow-y-hidden no-scrollbar touch-pan-x"
        >
          <div className="flex gap-3 sm:gap-4 px-4 w-max">
            {cards.map((card, i) => {
              const isVideo =
                card.isVideo ?? card.src.toLowerCase().endsWith(".mp4");
              return (
                <ReelCard
                  key={`${card.handle}-${i}`}
                  card={card}
                  isVideo={isVideo}
                  isPlaying={playingKey === i}
                  isUnmuted={playingKey === i && unmuted}
                  onPlay={() =>
                    setPlayingKey((cur) => {
                      if (cur === i) {
                        setUnmuted(false);
                        return null; // tap again to stop
                      }
                      return i;
                    })
                  }
                  onToggleSound={() => setUnmuted((u) => !u)}
                />
              );
            })}
          </div>
        </div>

        <div className="mt-8 text-center flex flex-col items-center gap-3">
          <Link
            href="/#sku"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-brand-red hover:bg-brand-red-hover text-white text-sm font-semibold shadow-lg transition-colors"
          >
            <ShoppingBag size={16} />
            Pick your drift — from ₹999, COD
          </Link>
          <Link
            href={`https://instagram.com/${THEME.instagramHandle}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-brand-ink-soft hover:text-brand-ink"
          >
            <InstagramIcon size={14} />
            Or follow @{THEME.instagramHandle} for new drops
          </Link>
        </div>
      </div>
    </section>
  );
}
