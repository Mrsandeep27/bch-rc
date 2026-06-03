import type { MetadataRoute } from "next";
import { getVisibleProducts } from "@/lib/products";
import { POLICIES } from "@/lib/policies";

const BASE = "https://pocketrccars.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const staticUrls: MetadataRoute.Sitemap = [
    { url: `${BASE}/`, lastModified: now, changeFrequency: "weekly", priority: 1.0 },
    { url: `${BASE}/track`, lastModified: now, changeFrequency: "monthly", priority: 0.4 },
  ];

  const productUrls: MetadataRoute.Sitemap = getVisibleProducts().map((p) => ({
    url: `${BASE}/product/${p.slug}`,
    lastModified: now,
    changeFrequency: "monthly",
    priority: 0.9,
  }));

  const policyUrls: MetadataRoute.Sitemap = POLICIES.map((p) => ({
    url: `${BASE}/policies/${p.slug}`,
    lastModified: now,
    changeFrequency: "yearly",
    priority: 0.3,
  }));

  return [...staticUrls, ...productUrls, ...policyUrls];
}
