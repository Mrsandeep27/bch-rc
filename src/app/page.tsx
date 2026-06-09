import { Suspense } from "react";
import dynamic from "next/dynamic";
import { AnnouncementBar } from "@/components/AnnouncementBar";
import Header from "@/components/Header";
import Hero from "@/components/Hero";
import HeroMiniFaq from "@/components/HeroMiniFaq";
import TrustMarquee from "@/components/TrustMarquee";
import SkuLineup from "@/components/SkuLineup";
import Footer from "@/components/Footer";
import HomeJsonLd from "@/components/HomeJsonLd";
import HomeClientUi from "@/components/HomeClientUi";
import { Skeleton, SkeletonGrid } from "@/components/Skeleton";
import { HOME_FAQS } from "@/lib/faqs";

// B06 — make the homepage edge-cacheable. ISR revalidates every hour; that's
// well below the cadence of any catalogue change (prices, stock, copy) but
// still lets a deploy refresh the cache via on-demand revalidation if needed.
// Combined with B05 (cookies no longer Set-Cookie'd on every render) Vercel
// will serve this from the edge instead of cold-rendering on every visit.
export const revalidate = 3600;

// Below-the-fold sections — still SSR'd (SEO + AI-citation), but the client JS
// is split into separate chunks that browsers fetch in parallel after the
// hero finishes painting. Skeletons act as the suspense placeholder during
// the brief streaming gap.
const FeatureCarousel = dynamic(() => import("@/components/FeatureCarousel"), {
  loading: () => <Skeleton className="h-80 w-full max-w-7xl mx-auto my-12" />,
});
const HowToUse = dynamic(() => import("@/components/HowToUse"), {
  loading: () => <Skeleton className="h-64 w-full max-w-6xl mx-auto my-12" />,
});
const CustomerReviewsSlider = dynamic(
  () => import("@/components/CustomerReviewsSlider"),
  {
    loading: () => <Skeleton className="h-96 w-full mx-auto my-12" />,
  },
);
const OurStorySection = dynamic(() => import("@/components/OurStorySection"), {
  loading: () => <Skeleton className="h-96 w-full max-w-7xl mx-auto my-12" />,
});
const UgcGrid = dynamic(() => import("@/components/UgcGrid"), {
  loading: () => (
    <div className="max-w-7xl mx-auto my-12 px-4">
      <SkeletonGrid count={6} />
    </div>
  ),
});
const BundlePicker = dynamic(() => import("@/components/BundlePicker"), {
  loading: () => <Skeleton className="h-96 w-full max-w-7xl mx-auto my-12" />,
});
// P03 — OfferStack (5-card offer soup) replaced by ValueStack (one totalled
// value-stack). The 2-car bundle lives in BundlePicker; the LED upgrade
// moves to the PDP upsell. Keeping the import comment so a future change
// can flip it back if A/B testing shows the soup outperforms.
const ValueStack = dynamic(() => import("@/components/ValueStack"), {
  loading: () => <Skeleton className="h-64 w-full max-w-7xl mx-auto my-12" />,
});
const FAQ = dynamic(() => import("@/components/FAQ"), {
  loading: () => <Skeleton className="h-96 w-full max-w-3xl mx-auto my-12" />,
});
const FinalCta = dynamic(() => import("@/components/FinalCta"), {
  loading: () => <Skeleton className="h-64 w-full max-w-7xl mx-auto my-12" />,
});

// UTM-driven hero variant + openCart query-param are now read CLIENT-SIDE
// by Hero (uses useSearchParams) and HomeClientUi (same). This server page
// no longer touches searchParams, which lets Next.js statically optimize the
// route + lets Vercel edge-cache the HTML.

export default function Page() {
  return (
    <>
      <HomeJsonLd faqs={HOME_FAQS} />
      <AnnouncementBar />
      <Header />
      <main className="flex-1 -mt-16 sm:-mt-20">
        {/* Suspense wrappers around useSearchParams consumers - Next.js
            requires a Suspense boundary above any client component that
            reads useSearchParams when the page is statically rendered. */}
        <Suspense fallback={<Hero />}>
          <Hero />
        </Suspense>
        {/* StickyMobileCTA observes this sentinel — when it scrolls above the
            viewport (i.e. the user is past the hero), the sticky buy bar
            appears. */}
        <div id="hero-end-sentinel" aria-hidden className="h-px w-full" />

        {/* F03 — top-3-objections mini-FAQ. Sits directly under the hero so
            COD / size / "what if it breaks?" are answered AT the decision
            pixel, not 13 sections down in the full FAQ. */}
        <HeroMiniFaq />

        {/* TrustMarquee — product-spec marquee (USB-C, 2.4 GHz, die-cast,
            etc.). Not a trust/policy strip; safe to keep here even though
            relievers also live in the hero. */}
        <TrustMarquee />

        {/* Order: hero -> mini-FAQ -> spec marquee -> SkuLineup (PRODUCTS
            high so the buyer can shop immediately) -> CustomerReviews
            slider (real buyer photos, immediate social proof after the
            shop) -> Our Story (founder + warehouse) -> UGC -> Features
            -> HowToUse -> BundlePicker -> ValueStack -> FAQ -> FinalCta.
            Each below-fold section is wrapped with .cv-auto so the
            browser skips paint/layout for off-screen content. */}
        <div className="cv-auto">
          <SkuLineup />
        </div>
        <div className="cv-auto">
          <CustomerReviewsSlider />
        </div>
        <div className="cv-auto">
          <OurStorySection />
        </div>
        <div className="cv-auto">
          <UgcGrid />
        </div>
        <div className="cv-auto">
          <FeatureCarousel />
        </div>
        <div className="cv-auto">
          <HowToUse />
        </div>
        <div className="cv-auto">
          <BundlePicker />
        </div>
        <div className="cv-auto">
          <ValueStack />
        </div>
        <div className="cv-auto">
          <FAQ />
        </div>
        <div className="cv-auto">
          <FinalCta />
        </div>
      </main>
      <Footer />
      <Suspense fallback={null}>
        <HomeClientUi />
      </Suspense>
    </>
  );
}
