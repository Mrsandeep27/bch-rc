import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { PRODUCTS, getVisibleProducts, type Sku } from "@/lib/products";
import { AnnouncementBar } from "@/components/AnnouncementBar";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import WhatsAppFab from "@/components/WhatsAppFab";
import CartDrawer from "@/components/CartDrawer";
import PDPClient from "@/components/PDPClient";
import { THEME } from "@/lib/theme";

/** Build a Google-readable schema.org Product JSON-LD blob for a SKU. */
function productJsonLd(sku: Sku) {
  const url = `https://${THEME.domain}/product/${sku.slug}`;
  const images = [sku.heroImage, ...sku.altImages]
    .filter(Boolean)
    .map((p) => `https://${THEME.domain}${p}`);

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: sku.name,
    description: `${sku.tagline}. ${sku.bullets.join(" ")}`,
    sku: sku.id,
    image: images,
    brand: {
      "@type": "Brand",
      name: THEME.brandName,
    },
    offers: {
      "@type": "Offer",
      priceCurrency: "INR",
      price: sku.retailINR.toString(),
      url,
      availability: "https://schema.org/InStock",
      itemCondition: "https://schema.org/NewCondition",
      priceValidUntil: "2027-12-31",
      seller: {
        "@type": "Organization",
        name: THEME.legal.tradeName,
      },
    },
    // No aggregateRating until we have verifiable, named customer reviews.
    // Google's structured-data policy prohibits fabricated ratings, and a
    // bare "4.8 / 6 reviews" without on-page proof poisons trust for the
    // scam-wary buyer who is the primary conversion target here.
  };
}

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
      {/* schema.org Product JSON-LD — Google rich results, price/rating in
          search, OpenGraph product cards on link previews */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd(sku)) }}
      />
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
      <WhatsAppFab />
      <CartDrawer />
    </>
  );
}
