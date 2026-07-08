"use client";

import dynamic from "next/dynamic";

// Mount the shared cart drawer on the hub so the header bag + product "Add to
// cart" open a working cart that checks out via the standard /checkout. Loaded
// client-only (ssr:false), same as the 1:64 home.
const CartDrawer = dynamic(() => import("@/components/CartDrawer"), { ssr: false });

export default function HubClientUi() {
  return <CartDrawer />;
}
