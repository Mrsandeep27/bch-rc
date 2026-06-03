import { THEME } from "@/lib/theme";
import { getVisibleProducts } from "@/lib/products";

type QA = { q: string; a: string };

/**
 * Server-rendered JSON-LD for the home page:
 *  - Organization (brand, GSTIN-backed legal name, contact)
 *  - ItemList of every visible SKU with price, brand, condition, availability
 *  - FAQPage echoing the on-page FAQ so Google can show rich answers in SERP
 *
 * Notes:
 *  - We deliberately do NOT emit aggregateRating until we have real,
 *    verifiable customer reviews. Fabricated stars are a Google policy
 *    violation and cost trust for the exact scam-wary buyer this brand
 *    needs to convert.
 *  - The Org/ItemList/FAQPage objects are emitted as a single @graph array
 *    so Google can crawl all three from one <script> tag.
 */
export default function HomeJsonLd({ faqs }: { faqs: QA[] }) {
  const products = getVisibleProducts();
  const base = `https://${THEME.domain}`;

  const organization = {
    "@type": "Organization",
    "@id": `${base}#org`,
    name: THEME.brandName,
    legalName: THEME.legal.legalName,
    url: base,
    logo: `${base}${THEME.logoMain}`,
    sameAs: [
      `https://instagram.com/${THEME.instagramHandle}`,
      `https://youtube.com/@${THEME.youtubeHandle}`,
    ],
    address: {
      "@type": "PostalAddress",
      streetAddress: THEME.legal.registeredAddress,
      addressLocality: "Bengaluru",
      addressRegion: "Karnataka",
      postalCode: "560064",
      addressCountry: "IN",
    },
    contactPoint: [
      {
        "@type": "ContactPoint",
        telephone: `+${THEME.whatsappNumber}`,
        contactType: "customer service",
        areaServed: "IN",
        availableLanguage: ["en", "hi"],
      },
    ],
  };

  const itemList = {
    "@type": "ItemList",
    "@id": `${base}#sku-list`,
    name: "Mini RC Drift Cars",
    itemListElement: products.map((p, i) => ({
      "@type": "ListItem",
      position: i + 1,
      item: {
        "@type": "Product",
        "@id": `${base}/product/${p.slug}`,
        name: p.name,
        description: p.tagline,
        image: `${base}${p.heroImage}`,
        sku: p.id,
        brand: { "@type": "Brand", name: THEME.brandName },
        category: "Toys & Games > Remote Control Cars",
        offers: {
          "@type": "Offer",
          url: `${base}/product/${p.slug}`,
          priceCurrency: "INR",
          price: p.retailINR,
          priceValidUntil: "2026-12-31",
          availability: "https://schema.org/InStock",
          itemCondition: "https://schema.org/NewCondition",
          seller: { "@id": `${base}#org` },
        },
      },
    })),
  };

  const faqPage = {
    "@type": "FAQPage",
    "@id": `${base}#faq`,
    mainEntity: faqs.map(({ q, a }) => ({
      "@type": "Question",
      name: q,
      acceptedAnswer: { "@type": "Answer", text: a },
    })),
  };

  const graph = {
    "@context": "https://schema.org",
    "@graph": [organization, itemList, faqPage],
  };

  return (
    <script
      type="application/ld+json"
      // Server-rendered, never user-generated — safe to inline.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(graph) }}
    />
  );
}
