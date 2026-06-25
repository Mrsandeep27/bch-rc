"use client";

/**
 * 1:16 mirror of the 1:64 <CustomerReviewsSlider /> — an auto-drifting rail of
 * buyer cards with short quoted one-liners. Same auto-scroll/drag/swipe
 * mechanics; the differences are scoped to /16:
 *   - Visuals use <Placeholder16 /> (real 1:16 buyer photos are shot later),
 *     so the rail's layout is final and only the <img> swaps in.
 *   - Copy is re-pitched for the big build: no "tiny / palm-size / ₹999"
 *     lines — these lead on size, rubber tyres and proportional steer.
 *
 * Auto-scroll loop, drag-to-scroll and reduced-motion handling are copied
 * verbatim from the 1:64 slider (battle-tested), so behaviour matches.
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
  { img: 1, name: "Arjun K.", city: "Bangalore", text: "Hallway became his racetrack from day one." },
  { img: 2, name: "Rohan S.", city: "Pune", text: "Box is so neat, didn't even need wrapping paper." },
  { img: 3, name: "Vivaan M.", city: "Mumbai", text: "Proper size and weight — feels like a real RC, not a toy." },
  { img: 4, name: "Aryan T.", city: "Hyderabad", text: "USB-C charge in 30 min, runs longer than my phone." },
  { img: 5, name: "Aditya P.", city: "Bangalore", text: "Rubber tyres actually slide on marble. Real drift, not toy drift." },
  { img: 6, name: "Ishaan R.", city: "Delhi NCR", text: "Proportional steering — I can feather the slide exactly how I want." },
  { img: 7, name: "Karan N.", city: "Chennai", text: "COD pe trust kiya — paid cash, all clean." },
  { img: 8, name: "Yash V.", city: "Ahmedabad", text: "Son drove it off the table. Not a single scratch." },
  { img: 9, name: "Krishna G.", city: "Bangalore", text: "4WD grip means it never spins out on the ramp." },
  { img: 10, name: "Devansh A.", city: "Indore", text: "Gave it as a birthday gift — the size made it feel premium." },
  { img: 11, name: "Atharv B.", city: "Pune", text: "Friend saw it at my place, ordered one same evening." },
  { img: 12, name: "Kabir J.", city: "Mumbai", text: "Same charger as my laptop. Zero hassle." },
  { img: 13, name: "Veer D.", city: "Bangalore", text: "Bought two so my dad could race me. He won." },
  { img: 15, name: "Reyansh H.", city: "Kolkata", text: "On vitrified tiles it slides like a full-size drift car." },
  { img: 16, name: "Daksh O.", city: "Bangalore", text: "Battery survives an entire after-school session." },
  { img: 18, name: "Aniruddh F.", city: "Pune", text: "Ordered Monday, in my hands by Wednesday. Fast." },
];

const SCROLL_SPEED_PX_PER_FRAME = 0.4; // ~24 px/sec at 60fps
const RESUME_AFTER_USER_INTERACTION_MS = 3000;

export default function CustomerReviews16() {
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
      if (paused && resumeAt > 0 && now >= resumeAt) {
        paused = false;
        resumeAt = 0;
      }

      if (!reducedMotion && !paused) {
        track.scrollLeft += SCROLL_SPEED_PX_PER_FRAME;
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
    track.addEventListener("mouseenter", pauseIndefinitely);
    track.addEventListener("mouseleave", resume);

    let isDragging = false;
    let dragStartX = 0;
    let dragStartScroll = 0;

    const onMouseDown = (e: MouseEvent) => {
      isDragging = true;
      dragStartX = e.pageX;
      dragStartScroll = track.scrollLeft;
      track.style.cursor = "grabbing";
      e.preventDefault();
    };
    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      track.scrollLeft = dragStartScroll - (e.pageX - dragStartX);
    };
    const endDrag = () => {
      if (!isDragging) return;
      isDragging = false;
      track.style.cursor = "grab";
    };

    track.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", endDrag);
    window.addEventListener("blur", endDrag);

    return () => {
      cancelAnimationFrame(rafId);
      mq.removeEventListener("change", onMqChange);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", endDrag);
      window.removeEventListener("blur", endDrag);
    };
  }, []);

  return (
    <section
      aria-labelledby="reviews16-title"
      className="bg-brand-cream border-y border-brand-line py-5 sm:py-7"
    >
      <header className="text-center mb-3 sm:mb-4 px-4">
        <p className="text-[10px] sm:text-xs font-mono uppercase tracking-widest text-brand-red">
          Real buyers · real cars
        </p>
        <h2
          id="reviews16-title"
          className="font-display text-2xl sm:text-3xl font-bold text-brand-ink mt-1"
        >
          What buyers actually say.
        </h2>
        <p className="hidden sm:block text-sm sm:text-base text-brand-ink-soft mt-1.5 max-w-xl mx-auto">
          Honest one-liners from the lineup&apos;s first owners. Drag to browse — or just let it auto-scroll.
        </p>
      </header>

      <div
        ref={trackRef}
        role="region"
        aria-label="Customer photo gallery — auto-scrolling, drag or swipe to browse"
        className="overflow-x-auto overflow-y-hidden no-scrollbar select-none cursor-grab"
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

function ReviewCard({ review, priority }: { review: Review; priority: boolean }) {
  const padded = String(review.img).padStart(2, "0");
  return (
    <li className="shrink-0 w-[170px] sm:w-[210px] relative rounded-2xl overflow-hidden bg-brand-ink">
      <div className="relative aspect-[3/4]">
        <Image
          src={`/reviews/review-${padded}.webp`}
          alt={`${review.name} from ${review.city} with their PRC drift car`}
          fill
          sizes="(max-width: 640px) 170px, 210px"
          priority={priority}
          loading={priority ? undefined : "lazy"}
          className="object-cover"
        />
        {/* Quote overlay — gradient floor so text stays readable. */}
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
