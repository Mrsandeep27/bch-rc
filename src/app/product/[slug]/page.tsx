import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { PRODUCTS, getVisibleProducts } from "@/lib/products";
import { AnnouncementBar } from "@/components/AnnouncementBar";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import StickyMobileCTA from "@/components/StickyMobileCTA";
import WhatsAppFab from "@/components/WhatsAppFab";
import CartDrawer from "@/components/CartDrawer";
import PDPClient from "@/components/PDPClient";

export function generateStaticParams() {
  // Only prerender visible SKUs. Hidden SKUs hit notFound() at runtime if anyone
  // navigates directly to their URL.
  return getVisibleProducts().map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const sku = PRODUCTS.find((p) => p.slug === slug);
  if (!sku) return { title: "Not Found" };
  return {
    title: `${sku.name} (${sku.scale}) — ₹${sku.retailINR}`,
    description: `${sku.tagline}. ${sku.bullets[0]}.`,
  };
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const sku = PRODUCTS.find((p) => p.slug === slug);
  if (!sku || sku.hidden) notFound();

  return (
    <>
      <AnnouncementBar />
      <Header />
      <nav className="border-b border-brand-line bg-white">
        <div className="max-w-6xl mx-auto px-4 py-3">
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-sm text-brand-ink-soft hover:text-brand-ink"
          >
            <ChevronLeft size={16} />
            Back to all products
          </Link>
        </div>
      </nav>
      <main className="flex-1 bg-white">
        <PDPClient sku={sku} />
      </main>
      <Footer />
      <StickyMobileCTA />
      <WhatsAppFab />
      <CartDrawer />
    </>
  );
}
