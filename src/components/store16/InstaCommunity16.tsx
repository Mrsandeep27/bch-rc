"use client";

/**
 * 1:16 "Insta + buyers" community block, modelled on the Mivo/Woody theme's
 * scattered-circles Instagram section — recoloured to the /16 monochrome theme.
 *
 * Two layered pieces in one section:
 *   1. A full-width DARK band (#0a0a0a) with the big "#PRC on Insta" headline,
 *      a "Find us" pill, and large VIDEO BUBBLES scattered around it. Each bubble
 *      autoplays a real UGC reel (muted, looped) and links to its Instagram post.
 *      Playback is gated to when the section is on screen (IntersectionObserver),
 *      so off-screen reels cost nothing; reduced-motion users get the poster only.
 *   2. A row of BUYER cards that OVERLAP upward into the bottom of the dark band
 *      (negative margin + higher z-index), giving the layered depth the owner
 *      asked for: "first insta one comes, then the buyer images overlap it."
 *
 * Colour discipline matches the hero: on the dark band we use on-dark neutrals
 * (white text / white pill) rather than the near-black accent token. Bubble
 * reels come from REELS; buyer photos/quotes reuse the CustomerReviews16
 * identities so nothing contradicts across the page. Swap the consts to retune.
 */

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ArrowUpRight } from "lucide-react";
import { InstagramIcon } from "@/components/BrandIcons";
import { STORE16 } from "@/lib/store16";

// Scattered, autoplaying UGC reels. Each carries BOTH a mobile and a desktop
// position (sm: override) plus responsive sizes, so the same scatter renders on
// phones too — mobile bubbles hug the top/bottom zones to frame the heading
// instead of covering it. The two large mid-band bubbles (idx 1 & 5) would sit
// over the centred copy on a narrow screen, so they're `hidden sm:block`.
const REELS = [
  // left column / mobile top-left → bottom-left. Mobile uses FIXED rem offsets
  // (top-*/bottom-*) so each bubble lands reliably inside the band's top/bottom
  // padding zone regardless of band height; desktop switches to % at sm.
  { src: "/ugc/164prccars-00.mp4", poster: "/ugc/164prccars-00.jpg", url: "https://www.instagram.com/p/DZAIls3SKQM/", pos: "left-3 top-4 sm:left-[1%] sm:top-[6%]", size: "h-16 w-16 sm:h-36 sm:w-36 lg:h-44 lg:w-44" },
  { src: "/ugc/164prccars-03.mp4", poster: "/ugc/164prccars-03.jpg", url: "https://www.instagram.com/p/DZFVT8Qyb-a/", pos: "hidden sm:block sm:left-[2%] sm:top-[42%]", size: "sm:h-40 sm:w-40 lg:h-48 lg:w-48" },
  { src: "/ugc/pocketrccar-03.mp4", poster: "/ugc/pocketrccar-03.jpg", url: "https://www.instagram.com/p/DY7B5jWPviR/", pos: "left-4 bottom-4 sm:left-[6%] sm:bottom-[5%]", size: "h-16 w-16 sm:h-36 sm:w-36 lg:h-40 lg:w-40" },
  { src: "/ugc/pocketrccar-02.mp4", poster: "/ugc/pocketrccar-02.jpg", url: "https://www.instagram.com/p/DZFUy4NP71h/", pos: "hidden sm:block sm:left-[20%] sm:top-[22%]", size: "sm:h-24 sm:w-24 lg:h-32 lg:w-32" },
  // right column / mobile top-right → bottom-right
  { src: "/ugc/164prccars-01.mp4", poster: "/ugc/164prccars-01.jpg", url: "https://www.instagram.com/p/DY9m339y9f7/", pos: "right-3 top-3 sm:right-[1%] sm:top-[8%]", size: "h-20 w-20 sm:h-36 sm:w-36 lg:h-44 lg:w-44" },
  { src: "/ugc/164prccars-02.mp4", poster: "/ugc/164prccars-02.jpg", url: "https://www.instagram.com/p/DZCyvf1S99i/", pos: "hidden sm:block sm:right-[2%] sm:top-[44%]", size: "sm:h-40 sm:w-40 lg:h-48 lg:w-48" },
  { src: "/ugc/pocketrccar-00.mp4", poster: "/ugc/pocketrccar-00.jpg", url: "https://www.instagram.com/p/DZAIKRYv7e0/", pos: "right-4 bottom-3 sm:right-[6%] sm:bottom-[5%]", size: "h-20 w-20 sm:h-36 sm:w-36 lg:h-40 lg:w-40" },
  { src: "/ugc/164prccars-00.mp4", poster: "/ugc/164prccars-00.jpg", url: "https://www.instagram.com/p/DZAIls3SKQM/", pos: "hidden sm:block sm:right-[20%] sm:top-[24%]", size: "sm:h-24 sm:w-24 lg:h-32 lg:w-32" },
] as const;

type Reel = (typeof REELS)[number];

/** The autoplaying reel <video>. Plays while `play` is true (section on
 *  screen), pauses otherwise so off-screen reels cost nothing. Shared by the
 *  desktop scatter bubbles and the mobile row so both actually play. */
function ReelVideo({ reel, play }: { reel: Reel; play: boolean }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (play) {
      const p = v.play();
      if (p && typeof p.catch === "function") p.catch(() => {});
    } else {
      v.pause();
    }
  }, [play]);

  return (
    <video
      ref={videoRef}
      src={reel.src}
      poster={reel.poster}
      muted
      loop
      playsInline
      preload="none"
      className="h-full w-full object-cover"
    />
  );
}

/** Desktop scatter bubble — absolutely positioned, links to the IG post. */
function ReelBubble({ reel, play }: { reel: Reel; play: boolean }) {
  return (
    <a
      href={reel.url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Watch this reel on Instagram"
      className={`pointer-events-auto absolute ${reel.pos} ${reel.size} group overflow-hidden rounded-full ring-4 ring-white/10 shadow-2xl transition-transform hover:scale-[1.04]`}
    >
      <ReelVideo reel={reel} play={play} />
      <span className="pointer-events-none absolute inset-0 rounded-full bg-black/0 transition-colors group-hover:bg-black/15" />
    </a>
  );
}

export default function InstaCommunity16() {
  const handle = STORE16.instagramHandle;
  const instaUrl = `https://instagram.com/${handle}`;

  const sectionRef = useRef<HTMLElement | null>(null);
  const [play, setPlay] = useState(false);

  // Only play the bubble reels while the section is on screen; honour
  // reduced-motion by never autoplaying (poster stays).
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;

    const io = new IntersectionObserver(
      ([entry]) => setPlay(entry.isIntersecting),
      { threshold: 0.12 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <section
      ref={sectionRef}
      className="relative bg-brand-ink"
      aria-label="PRC on Instagram"
    >
      {/* ── Dark Instagram scatter band ─────────────────────────────────── */}
      <div className="relative isolate overflow-hidden bg-brand-ink pt-28 pb-32 sm:pt-36 sm:pb-40">
        {/* scattered, autoplaying video bubbles — same scatter on mobile and
            desktop (positions/sizes switch at sm via the REELS classes). */}
        <div className="pointer-events-none absolute inset-0">
          {REELS.map((reel) => (
            <ReelBubble key={reel.pos} reel={reel} play={play} />
          ))}
        </div>

        {/* centered content */}
        <div className="relative z-10 mx-auto flex max-w-3xl flex-col items-center px-4 text-center">
          <span className="mb-4 inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.25em] text-white/70">
            <InstagramIcon size={14} /> @{handle}
          </span>
          <h2 className="font-display text-[2.75rem] font-bold leading-[0.95] tracking-tight text-white [text-shadow:0_2px_22px_rgba(0,0,0,0.65)] sm:text-6xl lg:text-7xl">
            <span className="text-brand-red">#</span>PRC on{" "}
            <span className="whitespace-nowrap text-brand-red">
              <Image
                src="/icons/instagram.png"
                alt=""
                width={56}
                height={56}
                className="mr-2 inline-block h-[0.78em] w-[0.78em] align-[-0.12em]"
              />
              Insta
            </span>
          </h2>
          <p className="mt-4 max-w-md text-sm text-white/75 [text-shadow:0_1px_10px_rgba(0,0,0,0.6)] sm:text-base">
            Real drifts, real homes, all across India. Tag{" "}
            <strong className="font-semibold text-white">@{handle}</strong> and land on the wall.
          </p>
          <a
            href={instaUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="group mt-7 inline-flex items-center gap-2 rounded-full bg-white px-7 py-3.5 text-sm font-semibold text-brand-ink shadow-xl transition-transform hover:scale-[1.03] active:scale-[0.98]"
          >
            <InstagramIcon size={16} />
            Find us
            <ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </a>
        </div>
      </div>
    </section>
  );
}
