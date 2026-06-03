import { AnnouncementBar } from "@/components/AnnouncementBar";
import Header from "@/components/Header";
import Hero from "@/components/Hero";
import TrustMarquee from "@/components/TrustMarquee";
import SkuLineup from "@/components/SkuLineup";
import FeatureCarousel from "@/components/FeatureCarousel";
import OurStorySection from "@/components/OurStorySection";
import UgcGrid from "@/components/UgcGrid";
import BundlePicker from "@/components/BundlePicker";
import OfferStack from "@/components/OfferStack";
import FAQ from "@/components/FAQ";
import FinalCta from "@/components/FinalCta";
import Footer from "@/components/Footer";
import WhatsAppFab from "@/components/WhatsAppFab";
import CartDrawer from "@/components/CartDrawer";
import ExitIntentModal from "@/components/ExitIntentModal";
import StickyMobileCTA from "@/components/StickyMobileCTA";
import HomeJsonLd from "@/components/HomeJsonLd";
import { HOME_FAQS } from "@/lib/faqs";
import type { HeroVariant } from "@/lib/copy";

// Map the ad UTM source → hero copy variant. Done server-side so Hero (the LCP
// element) renders on the server instead of bailing to client render via
// useSearchParams.
function heroVariantFromSource(source: string | null): HeroVariant {
  switch (source) {
    case "ig_gift":
      return "gift";
    case "ig_couple":
      return "couple";
    case "ig_parent":
      return "parent";
    case "ig_carride":
      return "carride";
    case "ig_drift":
    case "yt_drift":
      return "enthusiast";
    default:
      return "default";
  }
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ openCart?: string; utm_source?: string | string[] }>;
}) {
  const sp = await searchParams;
  const openCart = sp.openCart === "1" || sp.openCart === "true";
  const utmSource = Array.isArray(sp.utm_source)
    ? sp.utm_source[0] ?? null
    : sp.utm_source ?? null;
  const heroVariant = heroVariantFromSource(utmSource);
  return (
    <>
      <HomeJsonLd faqs={HOME_FAQS} />
      <AnnouncementBar />
      <Header />
      <main className="flex-1 -mt-16 sm:-mt-20">
        <Hero variant={heroVariant} />
        {/* StickyMobileCTA observes this sentinel — when it scrolls above the
            viewport (i.e. the user is past the hero), the sticky buy bar
            appears. */}
        <div id="hero-end-sentinel" aria-hidden className="h-px w-full" />
        <TrustMarquee />
        <SkuLineup />
        <FeatureCarousel />
        <OurStorySection />
        <UgcGrid />
        <BundlePicker />
        <OfferStack />
        <FAQ />
        <FinalCta />
      </main>
      <Footer />
      <WhatsAppFab />
      <CartDrawer initialOpen={openCart} />
      <StickyMobileCTA />
      <ExitIntentModal />
    </>
  );
}
