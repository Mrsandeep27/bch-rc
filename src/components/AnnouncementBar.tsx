"use client";

import { ANNOUNCEMENTS } from "@/lib/copy";
import { AUTO_COUPON } from "@/lib/config";

// Coupon stays as the first (and emphasized) chip in the marquee. Everything
// else trails behind it so the buyer always sees the code first as the track
// loops past.
const REST = ANNOUNCEMENTS.filter((a) => a.tag !== "CODE");

function Track() {
  // aria-hidden on every duplicate so screen readers only hear the messages
  // once (the first set of items in the live region below).
  return (
    <>
      <span className="inline-flex items-center gap-1.5 shrink-0 font-semibold">
        <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-white/20 text-[10px] font-bold tracking-wider uppercase">
          {AUTO_COUPON.code}
        </span>
        <span>{AUTO_COUPON.label}</span>
      </span>
      {REST.map((a, i) => (
        <span
          key={i}
          className="inline-flex items-center gap-1.5 shrink-0 text-white/90"
        >
          <span aria-hidden className="text-white/40">·</span>
          {a.emoji && <span aria-hidden>{a.emoji}</span>}
          <span>{a.text}</span>
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
