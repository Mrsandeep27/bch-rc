"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Zap, ShoppingBag } from "lucide-react";
import { type Sku } from "@/lib/products";
import { formatINR, calcDiscountPct, cn } from "@/lib/utils";
import { useCart } from "@/lib/cart-store";
import { ProductImage } from "@/components/ProductImage";
import { EmiBadge } from "@/components/EmiBadge";
import { THEME } from "@/lib/theme";
import { trackAddToCart, trackInitiateCheckout } from "@/lib/analytics-client";
import { trackFunnel } from "@/lib/funnel-client";

/** Swatch token (hex or `gradient:from,to[,...]`) → CSS background. */
export function swatchBg(swatch: string): string {
  if (swatch.startsWith("gradient:")) {
    return `linear-gradient(135deg, ${swatch.slice("gradient:".length)})`;
  }
  return swatch;
}

/**
 * Shoppable product card for the hub Shop grid + the per-category pages. Adds to
 * the SINGLE shared cart (`useCart`). Coming-soon SKUs render a price-less
 * "Coming soon" state with no buy buttons.
 */
export function HubProductCard({
  sku,
  stockMap,
  className,
}: {
  sku: Sku;
  stockMap: Record<string, number> | null;
  className?: string;
}) {
  const router = useRouter();
  const [hovered, setHovered] = useState(false);
  const [slug, setSlug] = useState<string | null>(sku.colors?.[0]?.slug ?? null);

  const pct = calcDiscountPct(sku.mrpINR, sku.retailINR);
  const online = sku.retailINR - THEME.prepaidDiscountINR;

  const variantKeys = sku.colors?.length
    ? sku.colors.map((c) => `${sku.id}:${c.slug}`)
    : [`${sku.id}:`];
  const comingSoon = sku.comingSoon ?? false;
  const soldOut = !comingSoon && stockMap !== null && variantKeys.every((k) => (stockMap[k] ?? 0) <= 0);

  // PDP link — every live product uses the shared /product/[slug] page (the
  // 64-style PDP, scale-agnostic). The hub is the only storefront now, so we
  // don't route to the old /16 store. Coming-soon SKUs aren't clickable.
  const pdpHref = comingSoon ? null : `/product/${sku.slug}`;

  // If the picked colour sells out once live stock loads, jump to first in-stock.
  useEffect(() => {
    if (!stockMap || !sku.colors?.length) return;
    if ((stockMap[`${sku.id}:${slug ?? ""}`] ?? 0) > 0) return;
    const firstIn = sku.colors.find((c) => (stockMap[`${sku.id}:${c.slug}`] ?? 0) > 0);
    if (firstIn) setSlug(firstIn.slug);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stockMap]);

  const add = (goToCheckout: boolean) => {
    if (soldOut) return;
    useCart.getState().add(sku.id, slug);
    trackAddToCart({ sku: sku.id, name: sku.name, priceInr: sku.retailINR, quantity: 1 });
    trackFunnel("add_to_cart", {
      skuId: sku.id,
      qty: 1,
      valueInr: sku.retailINR,
      via: goToCheckout ? "hub_buynow" : "hub",
    });
    if (goToCheckout) {
      trackInitiateCheckout(online);
      router.push("/checkout");
    }
  };

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={cn(
        "group flex flex-col overflow-hidden rounded-2xl border border-brand-line bg-white shadow-sm transition-shadow hover:shadow-md",
        className
      )}
    >
      {(() => {
        const overlay = (
          <>
            <ProductImage sku={sku} active={hovered} />
            {sku.badge && (sku.badge === "NEW" || sku.badge === "PRO") && (
              <span className="absolute left-3 top-3 z-10 rounded-full bg-brand-red px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white shadow-md">
                {sku.badge}
              </span>
            )}
            {comingSoon ? (
              <span className="absolute right-3 top-3 z-10 rounded-full bg-brand-ink px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white">
                Coming soon
              </span>
            ) : soldOut ? (
              <span className="absolute right-3 top-3 z-10 rounded-full bg-brand-ink px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white">
                Sold out
              </span>
            ) : null}
          </>
        );
        return pdpHref ? (
          <Link href={pdpHref} aria-label={`View ${sku.name}`} className="relative block aspect-square overflow-hidden">
            {overlay}
          </Link>
        ) : (
          <div className="relative aspect-square overflow-hidden">{overlay}</div>
        );
      })()}

      <div className="flex flex-1 flex-col gap-1.5 p-2.5 sm:gap-2 sm:p-4">
        <span className="font-mono text-[9px] uppercase tracking-widest text-brand-ink-soft sm:text-[10px]">{sku.scale}</span>
        {pdpHref ? (
          <Link href={pdpHref} className="font-display text-sm font-bold leading-tight text-brand-ink transition-colors hover:text-brand-red sm:text-base">
            {sku.name}
          </Link>
        ) : (
          <h3 className="font-display text-sm font-bold leading-tight text-brand-ink sm:text-base">{sku.name}</h3>
        )}

        {sku.colors && sku.colors.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            {sku.colors.map((c) => (
              <button
                key={c.slug}
                type="button"
                onClick={() => setSlug(c.slug)}
                title={c.name}
                aria-label={c.name}
                className={cn(
                  "h-4 w-4 rounded-full border shadow-sm transition-transform hover:scale-110 sm:h-5 sm:w-5",
                  slug === c.slug ? "ring-2 ring-brand-red ring-offset-1" : "border-brand-line"
                )}
                style={{ background: swatchBg(c.swatch) }}
              />
            ))}
          </div>
        )}

        {comingSoon ? (
          <>
            <div className="-mt-0.5">
              <span className="font-display text-base font-bold text-brand-ink sm:text-lg">Coming soon</span>
              <div className="mt-0.5 font-mono text-[10px] text-brand-ink-soft">Dropping shortly — price TBA</div>
            </div>
            <div className="mt-auto pt-1">
              <span className="inline-flex w-full items-center justify-center gap-1.5 rounded-full border border-brand-line bg-brand-cream px-3 py-2 text-[13px] font-semibold text-brand-ink-soft sm:px-4 sm:py-2.5 sm:text-sm">
                Coming soon
              </span>
            </div>
          </>
        ) : (
          <>
            <div className="-mt-0.5">
              <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
                <span className="text-base font-bold text-brand-ink sm:text-lg">{formatINR(online)}</span>
                <span className="font-mono text-[9px] uppercase tracking-widest text-brand-ink-soft">online</span>
                <span className="text-xs text-brand-ink-soft line-through">{formatINR(sku.mrpINR)}</span>
                <span className="font-mono text-[9px] font-semibold uppercase tracking-widest text-brand-red">{pct}% off</span>
              </div>
              <div className="mt-0.5 font-mono text-[10px] text-brand-ink-soft">or {formatINR(sku.retailINR)} COD</div>
              <EmiBadge priceInr={online} variant="card" className="mt-0.5" />
            </div>

            <div className="mt-auto flex flex-col gap-1.5 pt-1 sm:gap-2">
              <button
                type="button"
                disabled={soldOut}
                onClick={() => add(true)}
                className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-full bg-brand-red px-3 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-brand-red-hover disabled:opacity-50 sm:px-4 sm:py-2.5 sm:text-sm"
              >
                <Zap size={14} aria-hidden />
                {soldOut ? "Sold out" : `Buy now — ${formatINR(online)}`}
              </button>
              <button
                type="button"
                disabled={soldOut}
                onClick={() => add(false)}
                className="inline-flex items-center justify-center gap-1.5 rounded-full border border-brand-ink/15 bg-white px-3 py-1.5 text-[13px] font-semibold text-brand-ink transition-colors hover:border-brand-ink disabled:opacity-50 sm:px-4 sm:py-2 sm:text-sm"
              >
                <ShoppingBag size={13} aria-hidden />
                Add to cart
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
