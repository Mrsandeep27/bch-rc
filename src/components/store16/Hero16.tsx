import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { STORE16, formatINR16 } from "@/lib/store16";

/**
 * 1:16 hero — full-section banner image (dares-2-rooftop-sunset) with the copy
 * overlaid on the left over a left-dark gradient for contrast.
 *
 * Colour note: the .store-16 palette is monochrome (accent token → near-black),
 * which works on the LIGHT sections but would vanish on this dark photo. So the
 * hero deliberately renders on-dark neutrals — white CTA, a white underline for
 * the accent word, white trust dots — instead of reading the black accent token.
 */
export function Hero16() {
  const accent = STORE16.heroH1Accent;
  const [head] = STORE16.heroH1.split(accent);

  return (
    <section className="relative isolate overflow-hidden bg-brand-ink">
      {/* full-section banner image — keep the car (right of frame) visible */}
      <Image
        src="/hero-banners/dares-v2-2-rooftop-sunset.png"
        alt="PRC Dares 1:16 RC drift car at rooftop sunset"
        fill
        priority
        sizes="100vw"
        className="object-cover object-[62%_center]"
      />
      {/* contrast scrims — kept light so the photo reads; just enough darkening on
          the left third to hold the copy, and a soft floor fade. The car (right
          of frame) stays clear. */}
      <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/25 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" />
      {/* top scrim so the overlaid header stays legible over the sky */}
      <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/45 to-transparent" />
      {/* bottom scrim — sinks the bright sunlit concrete strip so the hero ends
          on a dark edge with no light seam at the fold */}
      <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/85 to-transparent" />

      <div className="relative mx-auto flex min-h-[100svh] max-w-7xl px-5 pb-20 pt-24 sm:px-10 sm:pb-24 sm:pt-32">
        {/* copy — full-height column so the CTA can hug the bottom on mobile
            (headline stays high, middle stays open for the photo) while staying
            vertically centred on desktop. Mirrors the 1:64 hero. */}
        <div className="hero-anim flex w-full max-w-xl flex-col justify-center">
          <span className="mb-4 inline-flex w-fit items-center gap-2.5 font-mono text-[11px] uppercase tracking-[0.25em] text-white/85">
            <span className="h-px w-6 bg-white/50" aria-hidden />
            {STORE16.eyebrow}
          </span>
          <h1 className="font-display text-[2.75rem] leading-[0.98] font-bold tracking-tight text-white [text-shadow:0_2px_18px_rgba(0,0,0,0.55)] sm:text-6xl lg:text-7xl">
            {head}
            <span className="text-brand-red">{accent}</span>
          </h1>
          <p className="mt-6 max-w-md text-base text-white/90 [text-shadow:0_1px_10px_rgba(0,0,0,0.5)] sm:text-lg">
            {STORE16.heroSub}
          </p>

          <div className="mt-auto pt-10 sm:mt-9 sm:pt-0 flex flex-col items-start gap-5">
            <div className="flex flex-wrap items-center gap-3">
              <a
                href="#lineup"
                className="group inline-flex items-center gap-2 rounded-full bg-white px-8 py-4 text-base font-semibold text-brand-ink shadow-xl transition-transform hover:scale-[1.02] active:scale-[0.98]"
              >
                {STORE16.heroCtaLabel}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </a>
              <span className="rounded-full border border-white/25 bg-white/10 px-4 py-2.5 font-mono text-[11px] uppercase tracking-widest text-white backdrop-blur-sm">
                from {formatINR16(2899)}
              </span>
            </div>
            <ul className="flex flex-wrap gap-x-5 gap-y-1.5 font-mono text-[11px] uppercase tracking-widest text-white/80">
              {STORE16.trust.map((t) => (
                <li key={t} className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-brand-red" />
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
