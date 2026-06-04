"use client";

import { ANNOUNCEMENTS } from "@/lib/copy";

// Auto-coupon pinned chip removed 2026-06-05 — no live promo code. Only the
// rotating offers (prepaid, free shipping, COD) ride the marquee now.
const REST = ANNOUNCEMENTS.filter((a) => a.tag !== "CODE");

function Track() {
  return (
    <>
      {REST.map((a, i) => (
        <span
          key={i}
          className="inline-flex items-center gap-1.5 shrink-0 text-white"
        >
          {a.emoji && <span aria-hidden>{a.emoji}</span>}
          <span>{a.text}</span>
          {i < REST.length - 1 && (
            <span aria-hidden className="text-white/40 ml-4">·</span>
          )}
        </span>
      ))}
    </>
  );
}

export function AnnouncementBar() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Site announcements"
      className="relative z-40 bg-brand-red text-white text-[12px] sm:text-[13px] font-medium tracking-wide overflow-hidden"
    >
      {/* The marquee track holds two identical copies of the message list.
          `animate-marquee` translates it by -50% so the second copy lands
          exactly where the first started — seamless loop, no visible jump.
          motion-reduce: stop the animation for users who opt out of motion. */}
      <div className="h-8 flex items-center">
        <div className="flex shrink-0 gap-4 whitespace-nowrap pr-4 animate-marquee motion-reduce:animate-none">
          <Track />
          <span aria-hidden className="inline-flex"><Track /></span>
        </div>
      </div>
    </div>
  );
}
