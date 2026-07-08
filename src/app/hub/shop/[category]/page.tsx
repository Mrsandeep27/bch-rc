import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AnnouncementBar } from "@/components/AnnouncementBar";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import HubClientUi from "@/components/hub/HubClientUi";
import HubCategoryView from "@/components/hub/HubCategoryView";
import { HUB_CATEGORIES, getHubCategory } from "@/lib/hub-categories";

// Full category page — the whole section for one hub category, opened from the
// "View Virtual Store" CTA on /hub. Kept out of search while the hub is WIP.
export const metadata: Metadata = {
  title: "PRC Cars — Shop (preview)",
  robots: { index: false, follow: false },
};

export const revalidate = 3600;

export function generateStaticParams() {
  // Only categories that actually have products get a page.
  return HUB_CATEGORIES.filter((c) => c.skus.length > 0).map((c) => ({ category: c.key }));
}

export default async function HubCategoryPage({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category } = await params;
  const cat = getHubCategory(category);
  if (!cat || cat.skus.length === 0) notFound();

  return (
    <>
      <main className="bg-white">
        <AnnouncementBar />
        <Header />
        <HubCategoryView categoryKey={cat.key} />
      </main>
      <Footer />
      {/* Shared cart drawer — same single cart as the hub. */}
      <HubClientUi />
    </>
  );
}
