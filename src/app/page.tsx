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

export default function Page() {
  return (
    <>
      <HomeJsonLd faqs={HOME_FAQS} />
      <AnnouncementBar />
      <Header />
      <main className="flex-1 -mt-16 sm:-mt-20">
        <Hero />
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
      <CartDrawer />
      <StickyMobileCTA />
      <ExitIntentModal />
    </>
  );
}
