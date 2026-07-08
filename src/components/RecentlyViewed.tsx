"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { getProductById, getVisibleProducts, type Sku } from "@/lib/products";
import { formatINR } from "@/lib/utils";
import { RECENTLY_VIEWED_KEY } from "@/lib/recently-viewed";

/** Random N items (Fisher–Yates) — runs client-side only (in useEffect), so no
 *  SSR/hydration concern. Keeps the rail fresh instead of always the first 4. */
function sample(arr: Sku[], n: number): Sku[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, n);
}

export default function RecentlyViewed({ excludeId }: { excludeId?: string }) {
  const [items, setItems] = useState<Sku[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(RECENTLY_VIEWED_KEY);
      const ids: string[] = raw ? JSON.parse(raw) : [];
      const recent = ids
        .filter((id) => id !== excludeId)
        .map((id) => getProductById(id))
        .filter((s): s is Sku => Boolean(s) && !s!.hidden && !s!.internal);

      // Always show a RANDOM 4 from the whole catalog so every model (incl. the
      // new ones) gets surfaced — not just whatever's in view-history. At most
      // one genuinely-recently-viewed car is kept up front for relevance, the
      // rest are random picks from everything else.
      const pool = getVisibleProducts().filter((p) => p.id !== excludeId);
      const lead = recent.slice(0, 1);
      const rest = sample(
        pool.filter((p) => !lead.some((s) => s.id === p.id)),
        4 - lead.length
      );
      setItems([...lead, ...rest].slice(0, 4));
    } catch {
      const pool = getVisibleProducts().filter((p) => p.id !== excludeId);
      setItems(sample(pool, 4));
    }
  }, [excludeId]);

  if (items.length === 0) return null;

  return (
    <section className="border-t border-brand-line bg-white py-6 sm:py-10">
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
            href="/#hub-shop"
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
