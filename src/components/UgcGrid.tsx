"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { Play } from "lucide-react";
import { InstagramIcon } from "@/components/BrandIcons";
import { THEME } from "@/lib/theme";

type UgcCard = {
  src: string;
  handle: string;
  caption: string;
  likes: string;
  isVideo?: boolean;
  /** Optional link to original Insta post */
  url?: string;
  /** Optional poster image to show before video first frame */
  poster?: string;
};

// Real posts pulled by scripts/scrape-instagram-ugc.py land here as a JSON
// manifest. Until you run that with an APIFY_TOKEN, this import safely
// resolves to an empty array via the fallback below.
let MANIFEST: UgcCard[] = [];
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  MANIFEST = require("@/lib/ugc-manifest.json") as UgcCard[];
} catch {
  MANIFEST = [];
}

// Stub fallback — until Apify quota resets. Handles point at the real PRC
// Instagram accounts so clicks land somewhere real.
const STUBS: UgcCard[] = [
  {
    src: "/products/PRC-bmw.jpg",
    handle: "164prccars",
    caption: "Pocket BMW · drift wheels on 🏁",
    likes: "1.2K",
    isVideo: true,
  },
  {
    src: "/products/PRC-porsche.jpg",
    handle: "pocketrccar",
    caption: "GT3 silhouette in dark blue",
    likes: "847",
  },
  {
    src: "/products/PRC-monster.jpg",
    handle: "164prccars",
    caption: "Monster Truck climbs anything",
    likes: "2.4K",
    isVideo: true,
  },
  {
    src: "/products/PRC-thar.jpg",
    handle: "pocketrccar",
    caption: "Thar off-roading on marble",
    likes: "612",
  },
  {
    src: "/products/PRC-f1-classic.jpg",
    handle: "164prccars",
    caption: "Pocket F1 · race day at home",
    likes: "1.9K",
    isVideo: true,
  },
  {
    src: "/products/PRC-bmw.jpg",
    handle: "pocketrccar",
    caption: "Behind the scenes · Bangalore HQ",
    likes: "534",
  },
];

export default function UgcGrid() {
  // Use real scraped posts when manifest is populated, otherwise stubs.
  // Both PRC Instagram accounts often cross-post the same reel, so dedupe
  // by post URL (or by caption as a fallback) before rendering.
  const source = MANIFEST.length >= 6 ? MANIFEST : STUBS;
  const seen = new Set<string>();
  const UGC = source.filter((c) => {
    const key = c.url ?? c.caption;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 12);
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
            to get featured.
          </p>
        </div>

        {/* Horizontal snap-scroll — each card is a reel-shaped 9:16 tile,
            scrollable left/right on every screen size. */}
        <div className="mt-8 -mx-4 sm:mx-0 overflow-x-auto snap-x snap-mandatory no-scrollbar">
          <div className="flex gap-3 sm:gap-4 px-4 sm:px-0 pb-4">
            {UGC.map((card, i) => {
              const href = card.url ?? `https://instagram.com/${card.handle}`;
              const isMp4 = card.src.toLowerCase().endsWith(".mp4");
              return (
                <motion.a
                  key={`${card.handle}-${i}`}
                  href={href}
                  target="_blank"
                  rel="noopener"
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: i * 0.04, ease: "easeOut" }}
                  className="group snap-center relative shrink-0 w-[180px] sm:w-[200px] aspect-[9/16] rounded-xl overflow-hidden bg-brand-ink border border-brand-line block"
                >
                  {isMp4 ? (
                    <video
                      src={card.src}
                      // Every scraped .mp4 has a sibling .jpg poster the
                      // scrape script wrote alongside it — derive the path
                      // by swapping the extension so the tile shows a frame
                      // instantly while autoplay/metadata still loads.
                      poster={card.poster ?? card.src.replace(/\.mp4$/i, ".jpg")}
                      muted
                      loop
                      playsInline
                      autoPlay
                      preload="metadata"
                      className="absolute inset-0 w-full h-full object-cover transform-gpu"
                    />
                  ) : (
                    <Image
                      src={card.src}
                      alt={`@${card.handle} · ${card.caption}`}
                      fill
                      sizes="200px"
                      className="object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  )}

                  {/* Top fade for handle legibility */}
                  <div className="absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b from-black/70 to-transparent pointer-events-none" />
                  {/* Bottom fade for caption/likes */}
                  <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/90 via-black/40 to-transparent pointer-events-none" />

                  {/* Play overlay — only shown on still images (videos auto-play) */}
                  {!isMp4 && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="w-12 h-12 rounded-full bg-white/15 backdrop-blur-sm border border-white/30 flex items-center justify-center group-hover:bg-white/30 transition-colors">
                        <Play
                          size={18}
                          className="fill-white text-white translate-x-0.5"
                        />
                      </div>
                    </div>
                  )}

                  {/* Top handle pill */}
                  <div className="absolute top-2.5 left-2.5 z-10 flex items-center gap-1 bg-black/60 backdrop-blur-sm text-white text-[10px] font-mono uppercase tracking-widest px-2 py-1 rounded-full">
                    <InstagramIcon size={10} />
                    <span className="truncate max-w-[110px]">
                      @{card.handle}
                    </span>
                  </div>

                  {/* Bottom info — caption only, no like count */}
                  <div className="absolute inset-x-0 bottom-0 p-3 text-white z-10">
                    <p className="text-xs font-semibold leading-tight line-clamp-2">
                      {card.caption}
                    </p>
                  </div>
                </motion.a>
              );
            })}
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
