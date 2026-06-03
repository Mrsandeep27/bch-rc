"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Script from "next/script";
import { useRouter } from "next/navigation";
import { MapPin, Minus, Plus, Tag, X } from "lucide-react";
import { nanoid } from "nanoid";
import { AnnouncementBar } from "@/components/AnnouncementBar";
import Footer from "@/components/Footer";
import { PayButton } from "@/components/PayButton";
import {
  useCart,
  getCartLines,
  getCartSubtotal,
  getCartCount,
} from "@/lib/cart-store";
import { OFFERS } from "@/lib/config";
import { formatINR } from "@/lib/utils";

type PaymentMethod = "upi" | "cod";

// Metro prefixes (first 2 digits) — 2-3 day delivery via Shiprocket. Everything
// else gets 3-5 days. Deterministic so the same pincode always shows the same
// date (no flashing as the user types other fields).
const METRO_PREFIXES = new Set([
  "11", // Delhi
  "12",
  "20", // Lucknow
  "30", // Jaipur
  "38", // Ahmedabad
  "40", // Mumbai
  "41", // Pune
  "44", // Chennai outer
  "50", // Hyderabad
  "56", // Bangalore
  "60", // Chennai
  "70", // Kolkata
]);

function estimateDeliveryDate(pincode: string): string {
  const today = new Date();
  const isMetro = METRO_PREFIXES.has(pincode.slice(0, 2));
  // Seed off the last 2 digits so two adjacent pincodes get slightly different
  // ETAs (feels real, not algorithmic).
  const seed = parseInt(pincode.slice(-2), 10) || 0;
  const offsetDays = isMetro ? 2 + (seed % 2) : 3 + (seed % 3); // metro 2-3, other 3-5
  const dt = new Date(today);
  dt.setDate(today.getDate() + offsetDays);
  return dt.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

/**
 * Poll the public order endpoint until payment shows CAPTURED. The webhook
 * captures the payment server-side even when our inline /verify call fails, so
 * this lets us confirm success out-of-band. Resolves true once captured, or
 * false after the timeout — either way the caller redirects the customer to
 * their order so they are never left stranded after a successful payment.
 */
async function waitForCapture(
  orderId: string,
  attempts = 6,
  delayMs = 2000,
): Promise<boolean> {
  for (let i = 0; i < attempts; i++) {
    try {
      const r = await fetch(`/api/orders/${orderId}`);
      if (r.ok) {
        const d = (await r.json()) as { paymentStatus?: string; status?: string };
        if (d.paymentStatus === "CAPTURED" || d.status === "PAID") return true;
      }
    } catch {
      /* keep polling — transient network error */
    }
    await new Promise((res) => setTimeout(res, delayMs));
  }
  return false;
}

type RazorpayOptions = {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  prefill?: { name?: string; email?: string; contact?: string };
  notes?: Record<string, string>;
  theme?: { color?: string };
  handler: (response: {
    razorpay_payment_id: string;
    razorpay_order_id: string;
    razorpay_signature: string;
  }) => void;
  modal?: { ondismiss?: () => void };
};

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => { open(): void };
  }
}

export default function CheckoutPage() {
  const router = useRouter();
  const items = useCart((s) => s.items);
  const hasHydrated = useCart((s) => s.hasHydrated);

  const lines = getCartLines(items);
  const subtotal = getCartSubtotal(items);
  const count = getCartCount(items);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [pincode, setPincode] = useState("");
  const [line1, setLine1] = useState("");
  const [line2, setLine2] = useState("");
  const [city, setCity] = useState("");
  const [stateName, setStateName] = useState("");
  const [payment, setPayment] = useState<PaymentMethod>("upi");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // True once Razorpay reports a successful payment and we're verifying /
  // waiting for capture. Keeps the customer informed and blocks re-submits.
  const [confirming, setConfirming] = useState(false);

  // Coupon UI state.
  const [couponCode, setCouponCode] = useState("");
  const [couponDiscountInr, setCouponDiscountInr] = useState(0);
  const [couponMessage, setCouponMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [couponBusy, setCouponBusy] = useState(false);
  const [couponApplied, setCouponApplied] = useState<string | null>(null);

  // Geo-locate / auto-fill state
  const [geoBusy, setGeoBusy] = useState(false);
  const [geoStatus, setGeoStatus] = useState<string | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);

  // Idempotency key — generated ONCE per checkout session. Same key on retry
  // → server short-circuits and returns the original order. Cleared after a
  // successful order so a fresh "Buy again" cycle starts a new key.
  const idempotencyKey = useMemo(() => nanoid(24), []);
  const submittingRef = useRef(false);
  // Set the instant Razorpay confirms payment — stops the modal's ondismiss
  // (which fires right after success) from re-enabling the button and allowing
  // a duplicate submit / double charge.
  const paidRef = useRef(false);

  useEffect(() => {
    // Wait for the persisted cart to rehydrate before treating it as empty —
    // otherwise a returning customer with a saved cart gets bounced home.
    if (hasHydrated && count === 0) {
      router.push("/");
    }
  }, [hasHydrated, count, router]);

  // If an applied coupon's discount would now be invalid (e.g. user removed
  // items and the new subtotal drops below the minimum), revalidate against
  // the server. If still valid, refresh the discount amount; if not, clear
  // the apply state so the customer doesn't see a misleading total.
  useEffect(() => {
    if (!couponApplied) return;
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(
          `/api/coupons/validate?code=${encodeURIComponent(couponApplied)}&siteId=prc&subtotalInr=${subtotal}&shippingInr=${subtotal >= OFFERS.freeShippingMinINR ? 0 : 85}`,
        );
        const data = (await r.json()) as {
          ok: boolean;
          code?: string;
          discountInr?: number;
          error?: string;
        };
        if (cancelled) return;
        if (!data.ok) {
          setCouponDiscountInr(0);
          setCouponApplied(null);
          setCouponMessage({
            kind: "error",
            text: `Coupon ${couponApplied} no longer valid: ${data.error ?? "rejected"}`,
          });
          return;
        }
        setCouponDiscountInr(data.discountInr ?? 0);
      } catch {
        // Network failure during revalidate — leave the existing discount in
        // place; server-side validation at order create will be authoritative.
      }
    })();
    return () => {
      cancelled = true;
    };
    // Re-runs when the cart subtotal OR the payment method changes, so the
    // shown discount + total always match what the server will compute.
  }, [couponApplied, subtotal, payment]);

  async function useMyLocation() {
    setGeoError(null);
    setGeoStatus(null);

    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGeoError(
        "Your browser doesn't support location detection. Type your address below.",
      );
      return;
    }

    setGeoBusy(true);
    setGeoStatus("Detecting your location…");

    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10_000,
          maximumAge: 60_000,
        });
      });

      setGeoStatus("Looking up your address…");
      const { latitude: lat, longitude: lon } = pos.coords;

      const r = await fetch(
        `/api/geocode/reverse?lat=${lat}&lon=${lon}`,
      );
      const data = (await r.json()) as {
        ok?: boolean;
        pincode?: string;
        city?: string;
        state?: string;
        line1?: string;
        countryCode?: string;
        error?: string;
      };

      if (!r.ok || !data.ok) {
        throw new Error(data.error || "Couldn't read address from coordinates");
      }

      if (data.countryCode && data.countryCode !== "IN") {
        throw new Error(
          "We only ship within India. Please type a delivery address inside India.",
        );
      }

      // Only overwrite fields the buyer hasn't typed themselves yet.
      if (data.line1 && !line1.trim()) setLine1(data.line1);
      if (data.city && !city.trim()) setCity(data.city);
      if (data.state && !stateName.trim()) setStateName(data.state);
      if (data.pincode && !pincode.trim()) setPincode(data.pincode);

      setGeoStatus("Address auto-filled. Edit anything before paying.");
    } catch (err: unknown) {
      const msg =
        err instanceof GeolocationPositionError
          ? err.code === 1
            ? "Location permission denied. Type your address below."
            : err.code === 2
              ? "Couldn't get your location signal. Try again or type your address."
              : "Location timed out. Try again."
          : err instanceof Error
            ? err.message
            : String(err);
      setGeoError(msg);
      setGeoStatus(null);
    } finally {
      setGeoBusy(false);
    }
  }

  const shipping = subtotal >= OFFERS.freeShippingMinINR ? 0 : 85;
  const codFee =
    payment === "cod" && subtotal < OFFERS.codFeeAppliesBelowINR
      ? OFFERS.codFeeINR
      : 0;
  const prepaidDiscount = payment === "upi" ? OFFERS.prepaidDiscountINR : 0;
  const total = Math.max(0, subtotal + shipping + codFee - prepaidDiscount - couponDiscountInr);

  function validate(): string | null {
    if (name.trim().length < 2) return "Please enter your full name.";
    if (!/^\d{10}$/.test(phone)) return "Enter a valid 10-digit mobile number.";
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) {
      return "Enter a valid email — we send your order confirmation there.";
    }
    if (!/^\d{6}$/.test(pincode)) return "Enter a valid 6-digit pincode.";
    if (line1.trim().length < 3) return "Please enter your address.";
    if (city.trim().length < 2) return "Please enter your city.";
    if (stateName.trim().length < 2) return "Please enter your state.";
    return null;
  }

  async function applyCoupon() {
    const code = couponCode.trim().toUpperCase();
    if (!code) {
      setCouponMessage({ kind: "error", text: "Enter a code" });
      return;
    }
    setCouponBusy(true);
    setCouponMessage(null);
    try {
      const r = await fetch(
        `/api/coupons/validate?code=${encodeURIComponent(code)}&siteId=prc&subtotalInr=${subtotal}&shippingInr=${shipping}`,
      );
      const data = (await r.json()) as {
        ok: boolean;
        code?: string;
        discountInr?: number;
        error?: string;
      };
      if (!data.ok) {
        setCouponDiscountInr(0);
        setCouponApplied(null);
        setCouponMessage({ kind: "error", text: data.error ?? "Coupon rejected" });
        return;
      }
      setCouponDiscountInr(data.discountInr ?? 0);
      setCouponApplied(data.code ?? code);
      setCouponMessage({
        kind: "ok",
        text: `Applied ${data.code ?? code} — ${formatINR(data.discountInr ?? 0)} off`,
      });
    } catch {
      setCouponMessage({ kind: "error", text: "Couldn't reach coupon service" });
    } finally {
      setCouponBusy(false);
    }
  }

  function clearCoupon() {
    setCouponCode("");
    setCouponApplied(null);
    setCouponDiscountInr(0);
    setCouponMessage(null);
  }

  async function handlePlaceOrder() {
    // Synchronous guard against React state-batching double-fire.
    if (submittingRef.current) return;
    setError(null);
    const validation = validate();
    if (validation) {
      setError(validation);
      return;
    }
    submittingRef.current = true;
    setLoading(true);
    try {
      const res = await fetch("/api/orders/create", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          siteId: "prc",
          idempotencyKey,
          items: items.map((i) => ({
            skuId: i.skuId,
            variantSlug: i.variantSlug,
            qty: i.qty,
          })),
          address: {
            fullName: name.trim(),
            phone,
            email: email.trim(),
            line1: line1.trim(),
            line2: line2.trim(),
            city: city.trim(),
            state: stateName.trim(),
            pincode,
          },
          paymentMethod: payment === "upi" ? "UPI" : "COD",
          couponCode: couponApplied || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create order");
      }

      if (data.paymentMethod === "COD") {
        useCart.getState().clear();
        router.push(`/orders/${data.orderId}`);
        return;
      }

      // Open Razorpay modal for prepaid.
      if (!window.Razorpay) {
        throw new Error("Razorpay SDK didn't load. Refresh and try again.");
      }
      const rzp = new window.Razorpay({
        key: data.razorpayKeyId,
        amount: data.amountInr * 100,
        currency: "INR",
        name: "PRC Cars",
        description: `Order ${data.orderId}`,
        order_id: data.razorpayOrderId,
        prefill: {
          name: data.customerName,
          email: data.customerEmail,
          contact: data.customerPhone,
        },
        theme: { color: "#0A0A0A" },
        handler: async (response) => {
          // Payment SUCCEEDED at Razorpay. From here the customer must never be
          // stranded — if our verify call fails, the webhook still captures it.
          paidRef.current = true;
          setError(null);
          setConfirming(true);
          try {
            const v = await fetch(`/api/orders/${data.orderId}/verify`, {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature,
              }),
            });
            const vData = await v.json().catch(() => ({}));
            if (!v.ok) throw new Error(vData.error || "Verification failed");
            useCart.getState().clear();
            router.push(`/orders/${data.orderId}`);
          } catch {
            // Verify failed (network/timeout) but the money was taken. Wait for
            // the webhook to mark it captured, then take them to their order —
            // never show a "failed" state for a payment that actually went through.
            await waitForCapture(data.orderId);
            useCart.getState().clear();
            router.push(`/orders/${data.orderId}`);
          } finally {
            submittingRef.current = false;
          }
        },
        modal: {
          ondismiss: () => {
            // Razorpay also fires ondismiss right after a successful payment —
            // don't reset state in that case, or the customer could re-submit
            // and get charged twice.
            if (paidRef.current) return;
            submittingRef.current = false;
            setLoading(false);
          },
        },
      });
      rzp.open();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      submittingRef.current = false;
      setLoading(false);
    }
  }

  const ctaLabel =
    payment === "upi"
      ? `Pay ${formatINR(total)} via UPI`
      : `Confirm COD order · ${formatINR(total)}`;

  const eta = pincode.length === 6 ? estimateDeliveryDate(pincode) : null;

  return (
    <>
      <Script
        src="https://checkout.razorpay.com/v1/checkout.js"
        strategy="lazyOnload"
      />
      <AnnouncementBar />

      <main className="bg-brand-cream min-h-screen py-12 px-4">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-3xl font-bold text-brand-ink">Checkout</h1>
          <p className="text-brand-ink-soft mt-2">
            Pay securely via UPI, cards, or COD.
          </p>

          <div className="mt-6 bg-white rounded-2xl border border-brand-line p-5">
            <div className="flex justify-between items-baseline">
              <div className="font-semibold text-brand-ink">Order summary</div>
              <div className="text-xs font-mono uppercase tracking-widest text-brand-ink-soft">
                {count} {count === 1 ? "item" : "items"}
              </div>
            </div>

            {/* Per-line: thumbnail + name + qty stepper + remove + line total.
                Buyers can fix mistakes ('I meant 1, not 2') without bouncing
                back to the cart drawer — a top reason for checkout abandonment
                on long-scroll mobile pages. */}
            <ul className="mt-4 space-y-3">
              {lines.map((l) => {
                const dec = () =>
                  useCart.getState().setQty(l.sku.id, l.variantSlug, l.qty - 1);
                const inc = () =>
                  useCart.getState().setQty(l.sku.id, l.variantSlug, l.qty + 1);
                const rm = () =>
                  useCart.getState().remove(l.sku.id, l.variantSlug);
                const labelSuffix = l.variantName ? ` (${l.variantName})` : "";
                return (
                  <li
                    key={`${l.sku.id}-${l.variantSlug ?? "default"}`}
                    className="flex items-center gap-3 border-t border-brand-line pt-3 first:border-t-0 first:pt-0"
                  >
                    <div className="relative w-14 h-14 sm:w-16 sm:h-16 shrink-0 rounded-lg overflow-hidden bg-brand-cream border border-brand-line">
                      <Image
                        src={l.variantImage ?? l.sku.heroImage}
                        alt={l.sku.name + labelSuffix}
                        fill
                        sizes="64px"
                        className="object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-brand-ink text-sm leading-tight truncate">
                        {l.sku.name}
                        {l.variantName ? (
                          <span className="text-brand-ink-soft font-normal"> · {l.variantName}</span>
                        ) : null}
                      </div>
                      <div className="text-xs text-brand-ink-soft mt-0.5">
                        {l.sku.scale} · {formatINR(l.unitPriceINR)} each
                      </div>
                      <div className="mt-2 inline-flex items-center border border-brand-line rounded-full overflow-hidden">
                        <button
                          type="button"
                          onClick={dec}
                          aria-label={`Decrease ${l.sku.name}${labelSuffix} quantity`}
                          className="h-11 w-11 flex items-center justify-center text-brand-ink hover:bg-brand-cream disabled:text-brand-ink-soft"
                          disabled={l.qty <= 1}
                        >
                          <Minus size={14} aria-hidden />
                        </button>
                        <span className="px-2 min-w-[1.5rem] text-center text-sm font-semibold tabular-nums text-brand-ink">
                          {l.qty}
                        </span>
                        <button
                          type="button"
                          onClick={inc}
                          aria-label={`Increase ${l.sku.name}${labelSuffix} quantity`}
                          className="h-11 w-11 flex items-center justify-center text-brand-ink hover:bg-brand-cream"
                        >
                          <Plus size={14} aria-hidden />
                        </button>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <div className="text-sm font-semibold text-brand-ink">
                        {formatINR(l.lineTotalINR)}
                      </div>
                      <button
                        type="button"
                        onClick={rm}
                        aria-label={`Remove ${l.sku.name}${labelSuffix} from cart`}
                        className="h-11 w-11 flex items-center justify-center text-brand-ink-soft hover:text-brand-red"
                      >
                        <X size={16} aria-hidden />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>

            <div className="mt-4 pt-3 border-t border-brand-line flex justify-between items-baseline">
              <span className="text-sm text-brand-ink-soft">Subtotal</span>
              <span className="font-semibold text-brand-ink">
                {formatINR(subtotal)}
              </span>
            </div>
          </div>

          <div className="mt-6 bg-white rounded-2xl border border-brand-line p-5">
            <h2 className="font-semibold text-brand-ink">
              Where should we ship?
            </h2>

            {/* One-tap address autofill via Geolocation + reverse-geocode.
                Same pattern as Swiggy / Zomato / Blinkit — buyer taps once,
                we prefill pincode / city / state / line 1 and they just edit
                the house number. Fields the buyer has already typed are
                preserved. */}
            <button
              type="button"
              onClick={useMyLocation}
              disabled={geoBusy}
              className="mt-4 w-full inline-flex items-center justify-center gap-2 rounded-lg border border-brand-line bg-brand-cream hover:border-brand-red hover:text-brand-red disabled:opacity-60 disabled:cursor-progress px-4 py-3 text-sm font-semibold text-brand-ink transition-colors"
            >
              <MapPin size={16} className="text-brand-red" aria-hidden />
              {geoBusy ? "Detecting…" : "Use my current location"}
            </button>
            {geoStatus && !geoError && (
              <p className="mt-2 text-xs text-success">{geoStatus}</p>
            )}
            {geoError && (
              <p className="mt-2 text-xs text-brand-red">{geoError}</p>
            )}

            <div className="mt-4 space-y-3">
              <input
                type="text"
                placeholder="Full name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-3 rounded-lg border border-brand-line focus:outline-none focus:border-brand-red text-brand-ink"
              />
              <div className="flex items-stretch border border-brand-line rounded-lg overflow-hidden focus-within:border-brand-red">
                <span className="px-3 py-3 bg-brand-cream text-brand-ink-soft text-sm font-mono flex items-center">
                  +91
                </span>
                <input
                  type="tel"
                  placeholder="10-digit mobile"
                  value={phone}
                  onChange={(e) =>
                    setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))
                  }
                  className="flex-1 px-4 py-3 focus:outline-none text-brand-ink"
                />
              </div>
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-lg border border-brand-line focus:outline-none focus:border-brand-red text-brand-ink"
              />
              <input
                type="text"
                inputMode="numeric"
                placeholder="Pincode (6 digit)"
                value={pincode}
                onChange={(e) =>
                  setPincode(e.target.value.replace(/\D/g, "").slice(0, 6))
                }
                className="w-full px-4 py-3 rounded-lg border border-brand-line focus:outline-none focus:border-brand-red text-brand-ink"
              />
              {eta && (
                <div className="text-success text-sm">
                  Delivered to {pincode} by {eta}
                </div>
              )}
              <input
                type="text"
                placeholder="Address line 1"
                value={line1}
                onChange={(e) => setLine1(e.target.value)}
                className="w-full px-4 py-3 rounded-lg border border-brand-line focus:outline-none focus:border-brand-red text-brand-ink"
              />
              <input
                type="text"
                placeholder="Address line 2 (optional)"
                value={line2}
                onChange={(e) => setLine2(e.target.value)}
                className="w-full px-4 py-3 rounded-lg border border-brand-line focus:outline-none focus:border-brand-red text-brand-ink"
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder="City"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg border border-brand-line focus:outline-none focus:border-brand-red text-brand-ink"
                />
                <input
                  type="text"
                  placeholder="State"
                  value={stateName}
                  onChange={(e) => setStateName(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg border border-brand-line focus:outline-none focus:border-brand-red text-brand-ink"
                />
              </div>
            </div>
          </div>

          <div className="mt-6 bg-white rounded-2xl border border-brand-line p-5">
            <h2 className="font-semibold text-brand-ink">
              How would you like to pay?
            </h2>
            <div className="mt-4 space-y-3">
              <label
                className={
                  payment === "upi"
                    ? "rounded-xl border border-brand-red p-4 cursor-pointer ring-2 ring-brand-red bg-brand-red-soft flex items-start gap-3"
                    : "rounded-xl border border-brand-line p-4 cursor-pointer flex items-start gap-3"
                }
              >
                <input
                  type="radio"
                  name="payment"
                  checked={payment === "upi"}
                  onChange={() => setPayment("upi")}
                  className="mt-1 accent-brand-red"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-brand-ink">
                      Pay with UPI · save ₹100
                    </span>
                    <span className="bg-brand-red text-white text-xs px-2 py-0.5 rounded-full">
                      Recommended
                    </span>
                  </div>
                  <div className="text-sm text-brand-ink-soft mt-1">
                    PhonePe · Google Pay · Paytm
                  </div>
                </div>
              </label>

              <label
                className={
                  payment === "cod"
                    ? "rounded-xl border border-brand-red p-4 cursor-pointer ring-2 ring-brand-red bg-brand-red-soft flex items-start gap-3"
                    : "rounded-xl border border-brand-line p-4 cursor-pointer flex items-start gap-3"
                }
              >
                <input
                  type="radio"
                  name="payment"
                  checked={payment === "cod"}
                  onChange={() => setPayment("cod")}
                  className="mt-1 accent-brand-red"
                />
                <div className="flex-1">
                  <div className="font-semibold text-brand-ink">
                    Cash on Delivery
                  </div>
                  <div className="text-sm text-brand-ink-soft mt-1">
                    Pay when delivered (₹{OFFERS.codFeeINR} fee on orders
                    below ₹{OFFERS.codFeeAppliesBelowINR})
                  </div>
                </div>
              </label>
            </div>
          </div>

          <div className="mt-6 bg-white rounded-2xl border border-brand-line p-5">
            <h2 className="font-semibold text-brand-ink flex items-center gap-2">
              <Tag size={16} className="text-brand-red" aria-hidden />
              Coupon code
            </h2>
            <div className="mt-3 flex items-stretch gap-2">
              <input
                type="text"
                inputMode="text"
                autoComplete="off"
                placeholder="e.g. CODEPRC100"
                value={couponCode}
                onChange={(e) =>
                  setCouponCode(e.target.value.toUpperCase().slice(0, 40))
                }
                disabled={!!couponApplied || couponBusy}
                className="flex-1 px-4 py-3 rounded-lg border border-brand-line focus:outline-none focus:border-brand-red text-brand-ink disabled:bg-brand-cream"
              />
              {couponApplied ? (
                <button
                  type="button"
                  onClick={clearCoupon}
                  className="px-4 py-3 rounded-lg border border-brand-line bg-white text-brand-ink-soft font-semibold hover:text-brand-red"
                >
                  Remove
                </button>
              ) : (
                <button
                  type="button"
                  onClick={applyCoupon}
                  disabled={couponBusy || !couponCode.trim()}
                  className="px-5 py-3 rounded-lg bg-brand-ink text-white font-semibold disabled:opacity-50"
                >
                  {couponBusy ? "Checking…" : "Apply"}
                </button>
              )}
            </div>
            {couponMessage && (
              <p
                className={
                  "mt-2 text-xs " +
                  (couponMessage.kind === "ok" ? "text-success" : "text-brand-red")
                }
              >
                {couponMessage.text}
              </p>
            )}
          </div>

          <div className="mt-6 bg-white rounded-2xl border border-brand-line p-5 space-y-2 text-brand-ink">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>{formatINR(subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span>Shipping</span>
              <span className={shipping === 0 ? "text-success font-semibold" : ""}>
                {shipping === 0 ? "FREE" : formatINR(shipping)}
              </span>
            </div>
            {codFee > 0 && (
              <div className="flex justify-between">
                <span>COD fee</span>
                <span>{formatINR(codFee)}</span>
              </div>
            )}
            {prepaidDiscount > 0 && (
              <div className="flex justify-between text-success">
                <span>Prepaid discount</span>
                <span>-{formatINR(prepaidDiscount)}</span>
              </div>
            )}
            {couponDiscountInr > 0 && (
              <div className="flex justify-between text-success">
                <span>Coupon{couponApplied ? ` (${couponApplied})` : ""}</span>
                <span>-{formatINR(couponDiscountInr)}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-brand-line pt-3 mt-3 font-bold text-lg">
              <span>Total</span>
              <span>{formatINR(total)}</span>
            </div>
          </div>

          <div className="sticky bottom-0 mt-6 -mx-4 px-4 py-3 bg-brand-cream/95 backdrop-blur lg:static lg:bg-transparent lg:mx-0 lg:px-0 lg:py-0">
            {confirming ? (
              <div className="mb-3 rounded-lg border border-success bg-success/10 px-4 py-3 text-sm text-success">
                Payment received — confirming your order… please don&apos;t close
                this page.
              </div>
            ) : error ? (
              <div className="mb-3 rounded-lg border border-brand-red bg-brand-red-soft px-4 py-3 text-sm text-brand-red">
                {error}
              </div>
            ) : null}
            <PayButton
              label={
                confirming
                  ? "Payment received — confirming…"
                  : loading
                    ? "Placing order..."
                    : ctaLabel
              }
              onClick={handlePlaceOrder}
              disabled={loading || confirming}
              loading={loading || confirming}
              className="w-full text-lg"
            />
            <p className="text-xs text-brand-ink-soft text-center mt-3">
              7-Day Free Replacement · Ships in 24 hrs from Bangalore
            </p>
          </div>
        </div>
      </main>

      <Footer />
    </>
  );
}
