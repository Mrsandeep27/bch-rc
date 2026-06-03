"use client";

/**
 * PDP-specific floating UI. Same pattern as HomeClientUi: ssr:false dynamic
 * imports so the cart drawer + WhatsApp FAB never pay the SSR cost on the
 * server HTML and ship as separate chunks fetched after first paint.
 */

import dynamic from "next/dynamic";

const CartDrawer = dynamic(() => import("@/components/CartDrawer"), {
  ssr: false,
});
const WhatsAppFab = dynamic(() => import("@/components/WhatsAppFab"), {
  ssr: false,
});

export default function PdpFloatingUi() {
  return (
    <>
      <WhatsAppFab />
      <CartDrawer />
    </>
  );
}
