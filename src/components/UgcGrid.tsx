"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { Play, Volume2, VolumeX } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

const MAX_CONCURRENT_VIDEOS = 2;

const STUBS: UgcCard[] = [
  {
    src: "/products/PRC-bmw.webp",
    handle: "164prccars",
    caption: "Pocket BMW · drift wheels on",
    likes: "1.2K",
    isVideo: true,
  },
  {
    src: "/products/PRC-porsche.webp",
    handle: "pocketrccar",
    caption: "GT3 silhouette in dark blue",
    likes: "847",
  },
  {
    src: "/products/PRC-monster.webp",
    handle: "164prccars",
    caption: "Monster Truck climbs anything",
    likes: "2.4K",
    isVideo: true,
  },
  {
    src: "/products/PRC-thar.webp",
    handle: "pocketrccar",
    caption: "Thar off-roading on marble",
    likes: "612",
  },
  {
    src: "/products/PRC-f1-classic.webp",
    handle: "164prccars",
    caption: "Pocket F1 · race day at home",
    likes: "1.9K",
    isVideo: true,
  },
  {
    src: "/products/PRC-bmw.webp",
    handle: "pocketrccar",
    caption: "Behind the scenes · Bangalore HQ",
    likes: "534",
  },
];

function ReelCard({
  card,
  index,
  cardRef,
  isActive,
  isUnmuted,
  onToggleSound,
}: {
  card: UgcCard;
  index: number;
  cardRef: (el: HTMLDivElement | null) => void;
  isActive: boolean;
  isUnmuted: boolean;
  onToggleSound: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const isMp4 = card.src.toLowerCase().endsWith(".mp4");
  const href = card.url ?? `https://instagram.com/${card.handle}`;

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (isActive) {
      const p = v.play();
      if (p && typeof p.catch === "function") p.catch(() => {});
    } else {
      v.pause();
    }
  }, [isActive]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !isUnmuted;
    if (isUnmuted) {
      v.volume = 1;
      const p = v.play();
      if (p && typeof p.catch === "function") p.catch(() => {});
    }
  }, [isUnmuted]);

  const onSoundToggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onToggleSound();
  };

  return (
    <motion.div
      ref={cardRef}
      data-reel-index={index}
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4, delay: index * 0.04, ease: "easeOut" }}
      className="group snap-center relative shrink-0 w-[180px] sm:w-[200px] aspect-[9/16] rounded-xl overflow-hidden bg-brand-ink border border-brand-line"
    >
      {isMp4 ? (
        <video
          ref={videoRef}
          src={card.src}
          poster={card.poster ?? card.src.replace(/\.mp4$/i, ".jpg")}
          muted={!isUnmuted}
          loop
          playsInline
          preload="metadata"
          className="absolute inset-0 w-full h-full object-cover transform-gpu"
        />
      ) : (
        <Image
          src={card.src}
          alt={`@${card.handle} · ${card.caption}`}
          fill
          sizes="200px"
          className="object-cover lg:group-hover:scale-105 transition-transform duration-500"
        />
      )}

      <a
        href={href}
        target="_blank"
        rel="noopener"
        aria-label={`Open @${card.handle} on Instagram`}
        className="absolute inset-0 z-10"
      />

      <div className="absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b from-black/70 to-transparent pointer-events-none z-20" />
      <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/90 via-black/40 to-transparent pointer-events-none z-20" />

      {!isMp4 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
          <div className="w-12 h-12 rounded-full bg-white/15 backdrop-blur-sm border border-white/30 flex items-center justify-center">
            <Play size={18} className="fill-white text-white translate-x-0.5" />
          </div>
        </div>
      )}

      <div className="absolute top-2.5 left-2.5 z-30 flex items-center gap-1 bg-black/60 backdrop-blur-sm text-white text-[10px] font-mono uppercase tracking-widest px-2 py-1 rounded-full pointer-events-none">
        <InstagramIcon size={10} />
        <span className="truncate max-w-[110px]">@{card.handle}</span>
      </div>

      {isMp4 && (
        <button
          type="button"
          onClick={onSoundToggle}
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
    </motion.div>
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

  const cardRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const ratiosRef = useRef<Map<number, number>>(new Map());
  const [activeIdxs, setActiveIdxs] = useState<Set<number>>(new Set());
  const [unmutedIdx, setUnmutedIdx] = useState<number | null>(null);

  const recompute = useCallback(() => {
    const top = [...ratiosRef.current.entries()]
      .filter(([, r]) => r > 0.5)
      .sort((a, b) => b[1] - a[1])
      .slice(0, MAX_CONCURRENT_VIDEOS)
      .map(([i]) => i);
    setActiveIdxs((prev) => {
      const next = new Set(top);
      if (prev.size === next.size && [...prev].every((i) => next.has(i))) {
        return prev;
      }
      return next;
    });
  }, []);

  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const idxAttr = (entry.target as HTMLElement).dataset.reelIndex;
          if (idxAttr == null) continue;
          const idx = Number(idxAttr);
          ratiosRef.current.set(idx, entry.intersectionRatio);
        }
        recompute();
      },
      { threshold: [0, 0.25, 0.5, 0.75, 1] }
    );
    for (const el of cardRefs.current.values()) io.observe(el);
    return () => io.disconnect();
  }, [recompute, UGC.length]);

  const setCardRef = useCallback(
    (idx: number) => (el: HTMLDivElement | null) => {
      if (el) cardRefs.current.set(idx, el);
      else cardRefs.current.delete(idx);
    },
    []
  );

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
            to get featured. Tap the speaker to hear.
          </p>
        </div>

        <div className="mt-8 -mx-4 sm:mx-0 overflow-x-auto snap-x snap-mandatory no-scrollbar touch-pan-x">
          <div className="flex gap-3 sm:gap-4 px-4 sm:px-0 pb-4">
            {UGC.map((card, i) => (
              <ReelCard
                key={`${card.handle}-${i}`}
                card={card}
                index={i}
                cardRef={setCardRef(i)}
                isActive={activeIdxs.has(i)}
                isUnmuted={unmutedIdx === i}
                onToggleSound={() =>
                  setUnmutedIdx((cur) => (cur === i ? null : i))
                }
              />
            ))}
          </div>
        </div>

        <div className="mt-8 text-center">
          <Link
            href={`https://instagram.com/${THEME.instagramHandle}`}
            target="_blank"
            rel="noopener"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border-2 border-brand-ink text-brand-ink hover:bg-brand-ink hover:text-white text-sm font-semibold transition-colors"
          >
            <InstagramIcon size={16} />
            Follow @{THEME.instagramHandle}
          </Link>
        </div>
      </div>
    </section>
  );
}
