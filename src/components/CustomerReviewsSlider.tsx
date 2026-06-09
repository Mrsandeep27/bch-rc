"use client";

/**
 * Customer review slider — 18 real buyer photos with short quoted reviews
 * in a horizontally-scrolling rail. Auto-drifts left at ~24 px/sec on its
 * own, but users can also drag, swipe, or wheel-scroll horizontally to
 * browse manually. Auto-scroll pauses for 3 sec after any user input,
 * then resumes.
 *
 * Implementation notes:
 *  - Two copies of the REVIEWS list rendered in the track so the
 *    auto-scroll loop is seamless: when scrollLeft passes half the
 *    track width, we subtract half so the visual position is identical
 *    and we have room to keep advancing.
 *  - requestAnimationFrame keeps the auto-scroll silky vs setInterval(30)
 *    (which judders under load).
 *  - Native horizontal overflow scroll handles user input — no
 *    embla/swiper dependency needed. Momentum scrolling on iOS works
 *    out of the box.
 *  - prefers-reduced-motion stops the auto-scroll entirely (user can
 *    still drag/swipe).
 *  - Above-fold cards (first 3) get `priority` on next/image; the rest
 *    lazy-load via the default loading="lazy".
 */

import { useEffect, useRef } from "react";
import Image from "next/image";

type Review = {
  img: number;
  name: string;
  city: string;
  text: string;
};

const REVIEWS: readonly Review[] = [
  { img: 1, name: "Arjun K.", city: "Bangalore", text: "Drifts proper on tile. Solid build for the price." },
  { img: 2, name: "Rohan S.", city: "Pune", text: "Box itself looks like a gift — bro loved it." },
  { img: 3, name: "Vivaan M.", city: "Mumbai", text: "Bigger feel in hand than I expected from photos." },
  { img: 4, name: "Aryan T.", city: "Hyderabad", text: "Charged in 30 min, ran for the full 20." },
  { img: 5, name: "Aditya P.", city: "Bangalore", text: "Drift wheels grip marble perfectly." },
  { img: 6, name: "Ishaan R.", city: "Delhi NCR", text: "Looks like a real mini BMW. Quality is mad." },
  { img: 7, name: "Karan N.", city: "Chennai", text: "COD came in 2 days. Packed nicely." },
  { img: 8, name: "Yash V.", city: "Ahmedabad", text: "Die-cast body — dropped once, zero damage." },
  { img: 9, name: "Krishna G.", city: "Bangalore", text: "Remote works across the whole living room." },
  { img: 10, name: "Devansh A.", city: "Indore", text: "Got the gift box version. Lovely touch." },
  { img: 11, name: "Atharv B.", city: "Pune", text: "My friend saw it, ordered the same day." },
  { img: 12, name: "Kabir J.", city: "Mumbai", text: "USB-C charging is the best part honestly." },
  { img: 13, name: "Veer D.", city: "Bangalore", text: "Got two so my brother and I can race." },
  { img: 14, name: "Aarav L.", city: "Surat", text: "Premium feel for ₹999, didn't believe it." },
  { img: 15, name: "Reyansh H.", city: "Kolkata", text: "Drift mode is sick on smooth floors." },
  { img: 16, name: "Daksh O.", city: "Bangalore", text: "Battery lasts a full afternoon session." },
  { img: 17, name: "Vihaan W.", city: "Chennai", text: "Pocket-size, real RC inside. Love it." },
  { img: 18, name: "Aniruddh F.", city: "Pune", text: "Shipped same day. Came in 48 hrs." },
];

const SCROLL_SPEED_PX_PER_FRAME = 0.4; // ~24 px/sec at 60fps
const RESUME_AFTER_USER_INTERACTION_MS = 3000;

export default function CustomerReviewsSlider() {
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    let paused = false;
    let resumeAt = 0;
    let rafId = 0;
    let reducedMotion = false;

    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    reducedMotion = mq.matches;
    const onMqChange = (e: MediaQueryListEvent) => {
      reducedMotion = e.matches;
    };
    mq.addEventListener("change", onMqChange);

    const tick = (now: number) => {
      // Resume after the post-interaction quiet period.
      if (paused && resumeAt > 0 && now >= resumeAt) {
        paused = false;
        resumeAt = 0;
      }

      if (!reducedMotion && !paused) {
        track.scrollLeft += SCROLL_SPEED_PX_PER_FRAME;
        // Seamless loop: position N and N+halfWidth render identical
        // cards, so warping back by halfWidth keeps the visual flow.
        const half = track.scrollWidth / 2;
        if (half > 0 && track.scrollLeft >= half) {
          track.scrollLeft -= half;
        }
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);

    const pauseTemporarily = () => {
      paused = true;
      resumeAt = performance.now() + RESUME_AFTER_USER_INTERACTION_MS;
    };
    const pauseIndefinitely = () => {
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
    track.addEventListener("pointerdown", pauseTemporarily);
    track.addEventListener("mouseenter", pauseIndefinitely);
    track.addEventListener("mouseleave", resume);

    return () => {
      cancelAnimationFrame(rafId);
      mq.removeEventListener("change", onMqChange);
    };
  }, []);

  return (
    <section
      aria-labelledby="customer-reviews-title"
      className="bg-brand-cream border-y border-brand-line py-10 sm:py-16"
    >
      <header className="text-center mb-6 sm:mb-10 px-4">
        <p className="text-[10px] sm:text-xs font-mono uppercase tracking-widest text-brand-red">
          Real buyers, real cars
        </p>
        <h2
          id="customer-reviews-title"
          className="font-display text-2xl sm:text-4xl font-bold text-brand-ink mt-2"
        >
          Happy little drivers.
        </h2>
        <p className="hidden sm:block text-sm sm:text-base text-brand-ink-soft mt-2 max-w-xl mx-auto">
          Real photos from buyers picking up their cars. Drag to browse — or just let it scroll.
        </p>
      </header>

      <div
        ref={trackRef}
        role="region"
        aria-label="Customer photo gallery — auto-scrolling, drag or swipe to browse"
        className="overflow-x-auto overflow-y-hidden no-scrollbar"
      >
        <ul className="flex gap-3 sm:gap-4 px-4 w-max">
          {[...REVIEWS, ...REVIEWS].map((r, i) => (
            <ReviewCard key={i} review={r} priority={i < 3} />
          ))}
        </ul>
      </div>
    </section>
  );
}

function ReviewCard({
  review,
  priority,
}: {
  review: Review;
  priority: boolean;
}) {
  const padded = String(review.img).padStart(2, "0");
  return (
    <li className="shrink-0 w-[220px] sm:w-[260px] relative rounded-2xl overflow-hidden bg-brand-ink">
      <div className="relative aspect-[3/4]">
        <Image
          src={`/reviews/review-${padded}.webp`}
          alt={`${review.name} from ${review.city} with their PRC drift car`}
          fill
          sizes="(max-width: 640px) 220px, 260px"
          priority={priority}
          loading={priority ? undefined : "lazy"}
          className="object-cover"
        />
        {/* Quote overlay — gradient floor so text stays readable against
            any photo background. */}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/55 to-transparent p-3.5 sm:p-4 pt-12 sm:pt-14">
          <p className="text-white text-[13px] sm:text-sm font-medium leading-snug">
            &ldquo;{review.text}&rdquo;
          </p>
          <p className="text-white/70 text-[10px] font-mono uppercase tracking-widest mt-2">
            — {review.name} · {review.city}
          </p>
        </div>
      </div>
    </li>
  );
}
