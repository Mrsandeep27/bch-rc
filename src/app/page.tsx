import { Suspense } from "react";
import dynamic from "next/dynamic";
import { AnnouncementBar } from "@/components/AnnouncementBar";
import Header from "@/components/Header";
import Hero from "@/components/Hero";
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
const OfferStack = dynamic(() => import("@/components/OfferStack"), {
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
        <TrustMarquee />
        {/* Each below-fold section is wrapped with .cv-auto (content-visibility:
            auto) so the browser skips paint/layout for whatever's off-screen.
            Direct .cv-auto on the imported sections would need a className prop
            on every component — wrapping is the smaller, safer change. */}
        <div className="cv-auto">
          <SkuLineup />
        </div>
        <div className="cv-auto">
          <FeatureCarousel />
        </div>
        <div className="cv-auto">
          <OurStorySection />
        </div>
        <div className="cv-auto">
          <UgcGrid />
        </div>
        <div className="cv-auto">
          <BundlePicker />
        </div>
        <div className="cv-auto">
          <OfferStack />
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
