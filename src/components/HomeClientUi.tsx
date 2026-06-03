"use client";

/**
 * Lazy-loaded floating UI (cart drawer, sticky CTA, exit-intent, WhatsApp).
 * Wrapped in a Client Component so we can use `dynamic(..., { ssr: false })`.
 * Each chunk only ships when this component mounts on the client, after the
 * initial server HTML is parsed — none of them are visible on first paint,
 * so paying SSR/initial-bundle cost was pure waste.
 */

import dynamic from "next/dynamic";

const CartDrawer = dynamic(() => import("@/components/CartDrawer"), {
  ssr: false,
});
const StickyMobileCTA = dynamic(() => import("@/components/StickyMobileCTA"), {
  ssr: false,
});
const ExitIntentModal = dynamic(() => import("@/components/ExitIntentModal"), {
  ssr: false,
});
const WhatsAppFab = dynamic(() => import("@/components/WhatsAppFab"), {
  ssr: false,
});

export default function HomeClientUi({ openCart }: { openCart: boolean }) {
  return (
    <>
      <WhatsAppFab />
      <CartDrawer initialOpen={openCart} />
      <StickyMobileCTA />
      <ExitIntentModal />
    </>
  );
}
