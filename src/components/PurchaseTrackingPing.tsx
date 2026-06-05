"use client";

/**
 * Fires the GA4 + Meta Pixel + CAPI `Purchase` event exactly once per order
 * when the order success page mounts.
 *
 * Idempotency: stores a flag in sessionStorage keyed by orderId so a refresh
 * doesn't re-fire (double-count in Meta = wasted ad spend on phantom
 * "winning" creatives). sessionStorage (not localStorage) means a fresh
 * browser session can re-track if the buyer comes back to the link in a
 * new window weeks later — that's a different actual visit.
 *
 * Lives in its own component so the order success page can stay a server
 * component (and read DB straight). This tiny client island is the only
 * piece that needs to run in the browser.
 */

import { useEffect } from "react";
import { trackPurchase } from "@/lib/analytics-client";

type Props = {
  orderId: string;
  totalInr: number;
  itemCount: number;
  paymentMethod: "UPI" | "CARD" | "NETBANKING" | "WALLET" | "COD";
  /** Customer email + phone if available — hashed server-side before going
   *  to Meta. Used as advanced-matching identifiers so CAPI links to the
   *  buyer profile even when the Pixel cookie wasn't there. */
  email?: string | null;
  phone?: string | null;
  contents?: Array<{
    sku: string;
    quantity: number;
    item_price: number;
    name?: string;
  }>;
};

export default function PurchaseTrackingPing(props: Props) {
  useEffect(() => {
    const key = `prc:fired:purchase:${props.orderId}`;
    if (typeof window === "undefined") return;
    if (window.sessionStorage?.getItem(key)) return;
    try {
      window.sessionStorage?.setItem(key, "1");
    } catch {
      // Private mode etc. — fail soft, fire anyway.
    }
    trackPurchase({
      orderId: props.orderId,
      totalInr: props.totalInr,
      itemCount: props.itemCount,
      paymentMethod: props.paymentMethod,
      email: props.email ?? null,
      phone: props.phone ?? null,
      contents: props.contents,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.orderId]);

  return null;
}
