import type { CSSProperties } from "react";

/**
 * 1:16 scroll-reveal "sliding images" gallery. One image starts large and
 * centred; as the section scrolls past, eight more slide in from off-screen to
 * complete a grid while the centre shrinks into its cell.
 *
 * The whole effect is pure CSS (scroll-driven `view-timeline`, defined under
 * `.slide-gallery` in globals.css) — no JS, no "use client". Chrome/Edge play
 * the reveal; browsers without `animation-timeline` get the final static grid.
 *
 * Tiles use CSS background-image (decorative), so they're driven by the simple
 * `--bg` custom property below — swap the paths to retune the imagery.
 */

const TILES = [
  { cls: "t1", bg: "/reviews/review-10.webp" },
  { cls: "t2", bg: "/reviews/review-12.webp" },
  { cls: "t3", bg: "/reviews/review-13.webp" },
  { cls: "t4", bg: "/reviews/review-14.webp" },
  { cls: "t5", bg: "/reviews/review-15.webp" },
  { cls: "t6", bg: "/reviews/review-16.webp" },
  { cls: "t7", bg: "/reviews/review-17.webp" },
  { cls: "t8", bg: "/reviews/review-18.webp" },
] as const;

const CENTER_BG = "/reviews/review-02.webp";

export default function SlideGallery16() {
  return (
    <section className="slide-gallery" aria-label="The 1:16 lineup in motion">
      <div className="slide-gallery__stage">
        {TILES.map((t) => (
          <div
            key={t.cls}
            className={`slide-gallery__tile ${t.cls}`}
            style={{ "--bg": `url(${t.bg})` } as CSSProperties}
          />
        ))}

        <div
          className="slide-gallery__tile center"
          style={{ "--bg": `url(${CENTER_BG})` } as CSSProperties}
        />
      </div>
    </section>
  );
}
