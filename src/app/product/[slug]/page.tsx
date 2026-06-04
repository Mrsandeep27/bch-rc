import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { PRODUCTS, getVisibleProducts, type Sku } from "@/lib/products";
import { AnnouncementBar } from "@/components/AnnouncementBar";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import PdpFloatingUi from "@/components/PdpFloatingUi";
import PDPClient from "@/components/PDPClient";
import { THEME } from "@/lib/theme";

/** Build a Google-readable schema.org @graph blob for a SKU.
 *  Combines Product + BreadcrumbList in one script tag — Google parses both. */
function productJsonLd(sku: Sku) {
  const url = `https://${THEME.domain}/product/${sku.slug}`;
  const images = [sku.heroImage, ...sku.altImages]
    .filter(Boolean)
    .map((p) => `https://${THEME.domain}${p}`);

  const product = {
    "@type": "Product",
    "@id": `${url}#product`,
    name: sku.name,
    description: `${sku.tagline}. ${sku.bullets.join(" ")}`,
    sku: sku.id,
    mpn: sku.id,
    image: images,
    category: "Toys & Games > Remote Control Cars",
    brand: { "@type": "Brand", name: THEME.brandName },
    offers: {
      "@type": "Offer",
      priceCurrency: "INR",
      price: sku.retailINR.toString(),
      url,
      availability: "https://schema.org/InStock",
      itemCondition: "https://schema.org/NewCondition",
      priceValidUntil: "2027-12-31",
      seller: { "@type": "Organization", name: THEME.legal.tradeName },
      hasMerchantReturnPolicy: {
        "@type": "MerchantReturnPolicy",
        applicableCountry: "IN",
        returnPolicyCategory: "https://schema.org/MerchantReturnFiniteReturnWindow",
        merchantReturnDays: 7,
        returnMethod: "https://schema.org/ReturnByMail",
        returnFees: "https://schema.org/FreeReturn",
      },
      shippingDetails: {
        "@type": "OfferShippingDetails",
        shippingDestination: { "@type": "DefinedRegion", addressCountry: "IN" },
        shippingRate: {
          "@type": "MonetaryAmount",
          value: "0",
          currency: "INR",
        },
        deliveryTime: {
          "@type": "ShippingDeliveryTime",
          handlingTime: { "@type": "QuantitativeValue", minValue: 0, maxValue: 1, unitCode: "DAY" },
          transitTime: { "@type": "QuantitativeValue", minValue: 2, maxValue: 7, unitCode: "DAY" },
        },
      },
    },
    // No aggregateRating until we have verifiable, named customer reviews.
    // Google's structured-data policy prohibits fabricated ratings.
  };

  const breadcrumb = {
    "@type": "BreadcrumbList",
    "@id": `${url}#crumbs`,
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: `https://${THEME.domain}/` },
      { "@type": "ListItem", position: 2, name: "Shop", item: `https://${THEME.domain}/#sku` },
      { "@type": "ListItem", position: 3, name: sku.name, item: url },
    ],
  };

  return {
    "@context": "https://schema.org",
    "@graph": [product, breadcrumb],
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

  const url = `/product/${sku.slug}`;
  const fullDescription =
    `${sku.tagline}. ${sku.bullets[0]}. ${sku.bullets[1]}. ` +
    `₹${sku.retailINR} · Pan-India COD · ships 24 hrs from Bangalore.`;

  return {
    title: `${sku.name} (${sku.scale}) — ₹${sku.retailINR}`,
    description: fullDescription.slice(0, 158),
    alternates: { canonical: url },
    openGraph: {
      title: `${sku.name} (${sku.scale}) · ₹${sku.retailINR}`,
      description: fullDescription.slice(0, 158),
      url,
      type: "website",
      images: [
        {
          url: sku.heroImage,
          width: 1200,
          height: 630,
          alt: `${sku.name} — ${sku.bodyShape}`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: `${sku.name} (${sku.scale}) · ₹${sku.retailINR}`,
      description: fullDescription.slice(0, 158),
      images: [sku.heroImage],
    },
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
      {/* schema.org Product + BreadcrumbList @graph — Google rich results,
          price in search, OpenGraph product cards on link previews.
          `<` is escaped so any future bullet/tagline containing `</script>`
          can't break out of the script tag. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(productJsonLd(sku)).replace(/</g, "\\u003c"),
        }}
      />
      <AnnouncementBar />
      <Header />
      <nav className="border-b border-brand-line bg-white">
        <div className="max-w-6xl mx-auto px-3 sm:px-4 py-1.5 sm:py-3">
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-xs sm:text-sm text-brand-ink-soft hover:text-brand-ink"
          >
            <ChevronLeft size={14} />
            <span className="sm:hidden">All products</span>
            <span className="hidden sm:inline">Back to all products</span>
          </Link>
        </div>
      </nav>
      <main className="flex-1 bg-white">
        <PDPClient sku={sku} />
      </main>
      <Footer />
      <PdpFloatingUi />
    </>
  );
}
