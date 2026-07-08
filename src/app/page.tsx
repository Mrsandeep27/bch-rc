import type { Metadata } from "next";
import { AnnouncementBar } from "@/components/AnnouncementBar";
import Header from "@/components/Header";
import HubHero from "@/components/hub/HubHero";
import HubTrustBar from "@/components/hub/HubTrustBar";
import HubShop from "@/components/hub/HubShop";
import BundlePicker from "@/components/BundlePicker";
import HubClientUi from "@/components/hub/HubClientUi";
import HubPerfBanner from "@/components/hub/HubPerfBanner";
import HubBestSellers from "@/components/hub/HubBestSellers";
import HubDriftVideo from "@/components/hub/HubDriftVideo";
import HubWhyPrc from "@/components/hub/HubWhyPrc";
import HubBuildYourOwn from "@/components/hub/HubBuildYourOwn";
import InstaCommunity16 from "@/components/store16/InstaCommunity16";
import CustomerReviewsSlider from "@/components/CustomerReviewsSlider";
import Footer from "@/components/Footer";
import HubSpinWheel from "@/components/hub/HubSpinWheel";

// The hub IS the homepage — the single storefront across every scale/category
// (mini 1:64, big 1:16, 1:20, construction, polo). Indexable: this is the main
// store page, not the old noindex preview.
export const metadata: Metadata = {
  title: "PRC Cars — Pocket RC Drift Cars, COD across India",
  description:
    "Shop RC drift cars from ₹999 — mini 1:64, big 1:16, construction & more. Cash on Delivery pan-India, 7-day replacement, ships in 24 hrs from Bangalore.",
  alternates: { canonical: "/" },
};

export const revalidate = 3600;

export default function Page() {
  return (
    <>
      <main className="bg-white">
        <AnnouncementBar />
        {/* Shared header — transparent over the hero on the homepage. */}
        <Header />
        {/* Pull the hero up BEHIND the transparent header. The header's height
            is h-16 sm:h-18, so the negative margin matches it. The hero itself
            is sized to (100svh − announcement bar). */}
        <div className="-mt-16 sm:-mt-[4.5rem]">
          <HubHero />
        </div>

        {/* trust bar — slim genuine-signal strip right under the hero
            (rating · orders shipped · replacement · secure COD). */}
        <HubTrustBar />

        {/* SHOP — category tabs → shoppable grid of every model, one shared
            cart (mix scales, checkout once). */}
        <HubShop />

        {/* BUNDLE — "Bundle & save" cards; % ladder off the shared cart. */}
        <BundlePicker />

        {/* pocket-performance promo banner (full-bleed) */}
        <HubPerfBanner />

        {/* best-sellers — one pick per range, each CTA opens that PDP */}
        <HubBestSellers />

        {/* drift video — clip + tagline */}
        <HubDriftVideo />

        {/* reviews — real-buyer-photo slider (compact cards on mobile) */}
        <CustomerReviewsSlider compact />

        {/* CTA band — social proof → shop */}
        <section className="bg-white pb-10 pt-2 text-center sm:pb-14">
          <a
            href="#hub-shop"
            className="inline-flex items-center gap-2 rounded-full bg-brand-red px-8 py-4 text-base font-bold text-white shadow-lg animate-heartbeat sm:text-lg"
          >
            Shop all models
            <span aria-hidden>→</span>
          </a>
        </section>

        {/* why buy PRC — differentiator strip */}
        <HubWhyPrc />

        {/* #PRC on Insta — scattered autoplaying UGC reels + Find-us CTA */}
        <InstaCommunity16 />

        {/* build your own PRC — model + colour configurator teaser */}
        <HubBuildYourOwn />

        {/* Final CTA band — last conversion push before the footer */}
        <section className="bg-brand-ink px-4 py-12 text-center text-white sm:py-16">
          <h2 className="font-display text-2xl font-extrabold uppercase tracking-wide sm:text-3xl">
            Ready to <span className="text-brand-red">drift</span>?
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-white/70 sm:text-base">
            Pan-India COD · 7-day replacement · ships in 24 hrs from Bangalore.
          </p>
          <a
            href="#hub-shop"
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-brand-red px-8 py-4 text-base font-bold text-white shadow-lg animate-heartbeat sm:text-lg"
          >
            Grab yours today
            <span aria-hidden>→</span>
          </a>
        </section>
      </main>
      {/* footer */}
      <Footer />
      {/* Lead capture — "drift for your discount" popup (pops 3s after entry) */}
      <HubSpinWheel />
      {/* Shared cart drawer — opened by the header bag + product "Add to cart" */}
      <HubClientUi />
    </>
  );
}
