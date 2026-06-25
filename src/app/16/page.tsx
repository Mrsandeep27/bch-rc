import { ArrowRight } from "lucide-react";
import { STORE16 } from "@/lib/store16";
import { Hero16 } from "@/components/store16/Hero16";
import MiniFaq16 from "@/components/store16/MiniFaq16";
import SpecMarquee16 from "@/components/store16/SpecMarquee16";
import { Lineup16 } from "@/components/store16/Lineup16";
// Hidden for now — kept for easy restore.
// import CustomerReviews16 from "@/components/store16/CustomerReviews16";
// import UgcGrid16 from "@/components/store16/UgcGrid16";
import InstaCommunity16 from "@/components/store16/InstaCommunity16";
import SlideGallery16 from "@/components/store16/SlideGallery16";
import HowToUse16 from "@/components/store16/HowToUse16";
import Header16 from "@/components/store16/Header16";
import Footer16 from "@/components/store16/Footer16";

export const revalidate = 3600;

export default function Store16Page() {
  return (
    <>
      <Header16 />

      <main className="flex-1">
        <Hero16 />

        {/* ── Before-you-buy mini-FAQ ────────────────────────────── */}
        <MiniFaq16 />

        {/* ── Spec marquee ───────────────────────────────────────── */}
        <SpecMarquee16 />

        {/* ── Lineup ─────────────────────────────────────────────── */}
        <Lineup16 />

        {/* ── Customer reviews — hidden for now ──────────────────── */}
        {/* <CustomerReviews16 /> */}

        {/* ── Drifters of India (UGC) — hidden for now ───────────── */}
        {/* <UgcGrid16 /> */}

        {/* ── #PRC on Insta + overlapping buyer cards ─────────────── */}
        <InstaCommunity16 />

        {/* ── Scroll-reveal "sliding images" gallery ──────────────── */}
        <SlideGallery16 />

        {/* ── How it works ───────────────────────────────────────── */}
        <HowToUse16 />

        {/* ── Bundle teaser — hidden for now ──────────────────────── */}
        {/* <section id="bundles" className="bg-brand-cream py-10 sm:py-12">
          <div className="mx-auto max-w-4xl px-5 text-center sm:px-10">
            <span className="font-mono text-[11px] uppercase tracking-[0.25em] text-brand-red">
              {STORE16.bundleEyebrow}
            </span>
            <h2 className="mt-2 font-display text-4xl text-brand-ink sm:text-5xl">
              {STORE16.bundleH2}
            </h2>
            <p className="mx-auto mt-3 max-w-md text-brand-ink-soft">{STORE16.bundleSub}</p>
            <a
              href={store16WaLink("Hi! I want to bundle two cars — what's the best price?")}
              target="_blank"
              rel="noopener noreferrer"
              className="cta-slice group mt-6 inline-flex items-center gap-2 rounded-full px-6 py-3 font-semibold"
            >
              Ask about bundle pricing
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </a>
          </div>
        </section> */}

        {/* ── FAQ ────────────────────────────────────────────────── */}
        <section id="faq" className="bg-white py-10 sm:py-14">
          <div className="mx-auto max-w-3xl px-5 sm:px-10">
            <div className="mb-6 text-center">
              <span className="font-mono text-[11px] uppercase tracking-[0.25em] text-brand-red">
                {STORE16.faqEyebrow}
              </span>
              <h2 className="mt-2 font-display text-3xl sm:text-5xl font-bold text-brand-ink">
                {STORE16.faqH2}
              </h2>
            </div>
            <div className="divide-y divide-brand-line rounded-2xl border border-brand-line">
              {STORE16.faqs.map((f) => (
                <details key={f.q} className="group px-5 py-4">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-semibold text-brand-ink">
                    {f.q}
                    <span className="text-brand-red transition-transform group-open:rotate-45">+</span>
                  </summary>
                  <p className="mt-2 text-sm text-brand-ink-soft">{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ── Final CTA ──────────────────────────────────────────── */}
        <section className="bg-brand-red py-12 text-center text-white">
          <div className="mx-auto max-w-3xl px-5 sm:px-10">
            <h2 className="font-display text-3xl sm:text-5xl font-bold">{STORE16.finalH2}</h2>
            <p className="mx-auto mt-3 max-w-md text-white/75">{STORE16.finalSub}</p>
            <a
              href="#lineup"
              className="mt-8 inline-flex items-center gap-2 rounded-full bg-white px-8 py-4 font-semibold text-brand-red transition-transform hover:scale-[1.02]"
            >
              {STORE16.finalCta}
              <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        </section>
      </main>

      <Footer16 />
    </>
  );
}
