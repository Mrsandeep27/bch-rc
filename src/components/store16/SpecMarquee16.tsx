/**
 * 1:16 mirror of the 1:64 <TrustMarquee />. Side-scrolling band of product
 * spec badges in the bold display face — same visual weight as the 1:64
 * marquee, just driven by STORE16.specMarquee so the copy stays config-owned.
 *
 * Spec badges only — no trust/policy items (COD, 7-day, ships-from). Those
 * live in <MiniFaq16 /> above; duplicating them here would read as one long
 * list of repeating slogans.
 *
 * Pure CSS animation via .animate-marquee (globals.css); the list is
 * duplicated twice so translateX(-50%) reveals a seamless second copy.
 */
import { STORE16 } from "@/lib/store16";

// Lead with the one scale mention the marquee carries, then the spec list.
const BADGES = ["1:16 SCALE", ...STORE16.specMarquee, "MADE IN INDIA"];

function Item({ name }: { name: string }) {
  return (
    <div className="flex items-center justify-center shrink-0 px-8 sm:px-12 border-l border-white/15 first:border-l-0">
      <span className="font-display text-white text-lg sm:text-xl font-bold tracking-tight whitespace-nowrap">
        {name}
      </span>
    </div>
  );
}

export default function SpecMarquee16() {
  const loop = [...BADGES, ...BADGES];

  return (
    <section
      className="relative bg-brand-ink py-4 sm:py-5 overflow-hidden"
      aria-label="Specs behind the 1:16 lineup"
    >
      {/* Fade edges so items don't pop in/out harshly */}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-16 sm:w-24 bg-gradient-to-r from-brand-ink to-transparent z-10" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-16 sm:w-24 bg-gradient-to-l from-brand-ink to-transparent z-10" />

      <div className="flex items-center w-max animate-marquee">
        {loop.map((name, i) => (
          <Item key={`${name}-${i}`} name={name} />
        ))}
      </div>
    </section>
  );
}
