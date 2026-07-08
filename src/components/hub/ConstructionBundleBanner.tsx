"use client";

import { useRouter } from "next/navigation";
import { Zap } from "lucide-react";
import { getConstructionBundle } from "@/lib/products";
import { useCart } from "@/lib/cart-store";
import { formatINR, calcDiscountPct } from "@/lib/utils";
import { THEME } from "@/lib/theme";
import { trackAddToCart, trackInitiateCheckout } from "@/lib/analytics-client";
import { trackFunnel } from "@/lib/funnel-client";

/**
 * Construction 3-Pack — a COMPACT promo banner with one big CTA that drops the
 * fixed-price bundle SKU (₹4,999 for all three rigs) into the shared cart as a
 * single line item, so checkout hits the exact set price. Renders nothing if
 * the bundle SKU is missing.
 */
export default function ConstructionBundleBanner() {
  const router = useRouter();
  const bundle = getConstructionBundle();
  if (!bundle) return null;

  const online = bundle.retailINR - THEME.prepaidDiscountINR;
  const pct = calcDiscountPct(bundle.mrpINR, bundle.retailINR);

  const buyNow = () => {
    useCart.getState().add(bundle.id, null);
    trackAddToCart({ sku: bundle.id, name: bundle.name, priceInr: bundle.retailINR, quantity: 1 });
    trackFunnel("add_to_cart", { skuId: bundle.id, qty: 1, valueInr: bundle.retailINR, via: "bundle_banner" });
    trackInitiateCheckout(online);
    router.push("/checkout");
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-brand-line bg-brand-ink text-white shadow-md">
      <div className="grid sm:grid-cols-5">
        {/* Banner art (add your 3-vehicle image here) */}
        {/* 16:10 keeps all three rigs visible; 16:7 cropped them badly */}
        <div className="relative aspect-[16/10] bg-black sm:col-span-2 sm:aspect-auto">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={bundle.heroImage}
            alt="Construction 3-Pack — Mining Truck, Excavator and Forklift"
            className="h-full w-full object-cover"
          />
          <span className="absolute left-3 top-3 rounded-full bg-brand-red px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider shadow">
            3-Pack deal
          </span>
        </div>

        {/* Compact copy + one CTA */}
        <div className="flex flex-col justify-center gap-1.5 p-4 sm:col-span-3 sm:p-5">
          <h3 className="font-display text-lg font-extrabold uppercase leading-tight sm:text-2xl">
            Construction <span className="text-brand-red">3-Pack</span>
          </h3>
          <p className="text-xs text-white/60 sm:text-sm">
            Mining Truck + Excavator + Forklift — all three in one order.
          </p>
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="font-display text-2xl font-extrabold sm:text-3xl">{formatINR(bundle.retailINR)}</span>
            <span className="text-sm text-white/45 line-through">{formatINR(bundle.mrpINR)}</span>
            <span className="rounded-full bg-success px-2 py-0.5 text-[10px] font-bold text-white">
              {pct}% off · save {formatINR(bundle.mrpINR - bundle.retailINR)}
            </span>
          </div>
          <button
            type="button"
            onClick={buyNow}
            className="mt-2 inline-flex items-center justify-center gap-2 rounded-full bg-brand-red px-5 py-3 text-sm font-bold text-white shadow-lg animate-heartbeat sm:text-base"
          >
            <Zap size={16} aria-hidden />
            Buy all 3 — {formatINR(bundle.retailINR)}
          </button>
        </div>
      </div>
    </div>
  );
}
