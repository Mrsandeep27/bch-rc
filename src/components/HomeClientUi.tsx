"use client";

/**
 * Lazy-loaded floating UI (cart drawer, sticky CTA, WhatsApp FAB).
 * Wrapped in a Client Component so we can use `dynamic(..., { ssr: false })`.
 * Each chunk only ships when this component mounts on the client, after the
 * initial server HTML is parsed — none of them are visible on first paint,
 * so paying SSR/initial-bundle cost was pure waste.
 *
 * `openCart` flag now read client-side from `?openCart=1` so the parent page
 * stays free of searchParams and can be edge-cached (B05/B06).
 */

import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";

const CartDrawer = dynamic(() => import("@/components/CartDrawer"), {
  ssr: false,
});
const StickyMobileCTA = dynamic(() => import("@/components/StickyMobileCTA"), {
  ssr: false,
});
const WhatsAppFab = dynamic(() => import("@/components/WhatsAppFab"), {
  ssr: false,
});

// ExitIntentModal (DRIFT100 "wait before you go" pop-up) removed 2026-06-05
// — the prepaid -₹100 line is the only ₹100-off mechanism now, so DRIFT100
// would have been a phantom code that 404'd at checkout. Component file
// kept in the repo to make re-enabling trivial if a real promo lands later.

export default function HomeClientUi() {
  const sp = useSearchParams();
  const openCart = sp?.get("openCart") === "1" || sp?.get("openCart") === "true";
  return (
    <>
      <WhatsAppFab />
      <CartDrawer initialOpen={openCart} />
      <StickyMobileCTA />
    </>
  );
}
