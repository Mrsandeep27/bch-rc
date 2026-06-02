"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { getProductById, getVisibleProducts, type Sku } from "@/lib/products";
import { formatINR } from "@/lib/utils";

const STORAGE_KEY = "prc-recently-viewed";
const MAX = 6;

/** Record a viewed SKU (called from PDP on mount) */
export function recordView(skuId: string) {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const list: string[] = raw ? JSON.parse(raw) : [];
    const next = [skuId, ...list.filter((id) => id !== skuId)].slice(0, MAX);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // localStorage may be unavailable (private mode / quota); silently no-op
  }
}

export default function RecentlyViewed({ excludeId }: { excludeId?: string }) {
  const [items, setItems] = useState<Sku[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const ids: string[] = raw ? JSON.parse(raw) : [];
      const skus = ids
        .filter((id) => id !== excludeId)
        .map((id) => getProductById(id))
        .filter((s): s is Sku => Boolean(s) && !s!.hidden);

      // Pad with other visible products if list is short
      if (skus.length < 4) {
        const pad = getVisibleProducts()
          .filter((p) => p.id !== excludeId && !skus.some((s) => s.id === p.id))
          .slice(0, 4 - skus.length);
        skus.push(...pad);
      }
      setItems(skus.slice(0, 4));
    } catch {
      setItems(getVisibleProducts().filter((p) => p.id !== excludeId).slice(0, 4));
    }
  }, [excludeId]);

  if (items.length === 0) return null;

  return (
    <section className="border-t border-brand-line bg-white py-10 sm:py-14">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex items-baseline justify-between">
          <div>
            <p className="text-xs font-mono font-bold uppercase tracking-widest text-brand-red">
              Recently viewed
            </p>
            <h2 className="text-xl sm:text-2xl font-bold text-brand-ink mt-1">
              Pick up where you left off
            </h2>
          </div>
          <Link
            href="/#sku"
            className="hidden sm:inline text-sm font-semibold text-brand-red hover:underline underline-offset-4"
          >
            See all →
          </Link>
        </div>

        <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          {items.map((sku) => (
            <Link
              key={sku.id}
              href={`/product/${sku.slug}`}
              className="group block bg-white border border-brand-line rounded-xl overflow-hidden hover:border-brand-red hover:shadow-md transition-all"
            >
              <div className="aspect-square relative bg-brand-cream">
                <Image
                  src={sku.heroImage}
                  alt={sku.name}
                  fill
                  sizes="(max-width: 640px) 50vw, 25vw"
                  className="object-contain"
                />
              </div>
              <div className="p-3">
                <p className="text-sm font-semibold text-brand-ink truncate group-hover:text-brand-red">
                  {sku.name}
                </p>
                <p className="text-sm font-bold text-brand-ink mt-1">
                  {formatINR(sku.retailINR)}
                  <span className="ml-2 text-xs text-brand-ink-soft line-through font-normal">
                    {formatINR(sku.mrpINR)}
                  </span>
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
