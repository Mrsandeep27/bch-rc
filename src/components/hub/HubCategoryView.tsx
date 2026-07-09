"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getHubCategory, HUB_CATEGORIES } from "@/lib/hub-categories";
import { HubProductCard } from "@/components/hub/HubProductCard";
import ConstructionBundleBanner from "@/components/hub/ConstructionBundleBanner";

/**
 * Full category page body (rendered at /hub/shop/[category]) — the whole
 * section for ONE category: a tile switcher across categories + the complete
 * product grid. Cards add to the shared cart (same as the hub Shop preview).
 */
type ReviewSummary = { count: number; averageRating: number };

export default function HubCategoryView({ categoryKey }: { categoryKey: string }) {
  const [stockMap, setStockMap] = useState<Record<string, number> | null>(null);
  const [salesMap, setSalesMap] = useState<Record<string, number> | null>(null);
  const [reviewsMap, setReviewsMap] = useState<Record<string, ReviewSummary> | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/stock")
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled && d && typeof d.stock === "object") setStockMap(d.stock);
      })
      .catch(() => {});
    // Real 30-day units sold — drives "Selling fast", "N sold this month" and
    // the earned BESTSELLER badge. Independent of stock: a failure here costs
    // social proof, not the ability to buy.
    fetch("/api/sales")
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled && d && typeof d.sales === "object") setSalesMap(d.sales);
      })
      .catch(() => {});
    // Approved-review summaries. Absent SKUs render no star row at all.
    fetch("/api/reviews/summary")
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled && d && typeof d.reviews === "object") setReviewsMap(d.reviews);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const cat = getHubCategory(categoryKey) ?? HUB_CATEGORIES[0];

  return (
    <section className="bg-brand-cream pt-3 pb-8 sm:pt-5 sm:pb-14">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-widest text-brand-ink-soft transition-colors hover:text-brand-red"
        >
          <ArrowLeft size={14} aria-hidden />
          Back to shop
        </Link>

        {/* Compact header: title + model count on ONE line (mobile); the
            "Shop" eyebrow only appears on desktop. */}
        <div className="mt-1.5 sm:mt-3">
          <span className="hidden font-mono text-[11px] uppercase tracking-[0.3em] text-brand-red sm:inline-block">Shop</span>
          <div className="flex flex-wrap items-baseline gap-x-2 sm:mt-1 sm:block">
            <h1 className="font-display text-2xl font-extrabold uppercase tracking-wide text-brand-ink sm:text-4xl">
              {cat.label}
            </h1>
            <p className="text-xs text-brand-ink-soft sm:mt-1 sm:text-sm">{cat.skus.length} models</p>
          </div>
        </div>

        {/* Construction 3-Pack CTA banner — one big button, adds all 3 at ₹4,999 */}
        {categoryKey === "construction" && (
          <div className="mt-3 sm:mt-6">
            <ConstructionBundleBanner />
          </div>
        )}

        {/* full product grid */}
        <div className="mt-4 grid grid-cols-2 gap-3 sm:mt-8 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4">
          {cat.skus.map((sku) => (
            <HubProductCard
              key={sku.id}
              sku={sku}
              stockMap={stockMap}
              salesMap={salesMap}
              reviewsMap={reviewsMap}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
