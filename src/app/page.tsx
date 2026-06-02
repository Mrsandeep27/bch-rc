import { Suspense } from "react";
import { AnnouncementBar } from "@/components/AnnouncementBar";
import Header from "@/components/Header";
import Hero from "@/components/Hero";
import TrustMarquee from "@/components/TrustMarquee";
import StatsStrip from "@/components/StatsStrip";
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
import SocialProofToast from "@/components/SocialProofToast";
import Loader from "@/components/Loader";

export default function Page() {
  return (
    <>
      <AnnouncementBar />
      <Header />
      <main className="flex-1 -mt-16 sm:-mt-20">
        <Suspense
          fallback={
            <div className="min-h-screen bg-brand-ink flex items-center justify-center">
              <Loader label="Revving up…" className="text-white" />
            </div>
          }
        >
          <Hero />
        </Suspense>
        <TrustMarquee />
        <StatsStrip />
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
      <SocialProofToast />
      <ExitIntentModal />
    </>
  );
}
