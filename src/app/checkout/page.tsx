"use client";

import { useEffect, useState } from "react";
import Script from "next/script";
import { useRouter } from "next/navigation";
import { AnnouncementBar } from "@/components/AnnouncementBar";
import Footer from "@/components/Footer";
import { PayButton } from "@/components/PayButton";
import {
  useCart,
  getCartSubtotal,
  getCartCount,
} from "@/lib/cart-store";
import { OFFERS } from "@/lib/config";
import { formatINR } from "@/lib/utils";

type PaymentMethod = "upi" | "cod";

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

  useEffect(() => {
    if (count === 0) {
      router.push("/cart");
    }
  }, [count, router]);

  const shipping = subtotal >= OFFERS.freeShippingMinINR ? 0 : 85;
  const codFee =
    payment === "cod" && subtotal < OFFERS.codFeeAppliesBelowINR
      ? OFFERS.codFeeINR
      : 0;
  const prepaidDiscount = payment === "upi" ? OFFERS.prepaidDiscountINR : 0;
  const total = subtotal + shipping + codFee - prepaidDiscount;

  function validate(): string | null {
    if (name.trim().length < 2) return "Please enter your full name.";
    if (!/^\d{10}$/.test(phone)) return "Enter a valid 10-digit mobile number.";
    if (!/^\d{6}$/.test(pincode)) return "Enter a valid 6-digit pincode.";
    if (line1.trim().length < 3) return "Please enter your address.";
    if (city.trim().length < 2) return "Please enter your city.";
    if (stateName.trim().length < 2) return "Please enter your state.";
    return null;
  }

  async function handlePlaceOrder() {
    setError(null);
    const validation = validate();
    if (validation) {
      setError(validation);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/orders/create", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          siteId: "prc",
          items: items.map((i) => ({ skuId: i.skuId, qty: i.qty })),
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
          try {
            const v = await fetch(`/api/orders/${data.orderId}/verify`, {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature,
              }),
            });
            const vData = await v.json();
            if (!v.ok) throw new Error(vData.error || "Verification failed");
            useCart.getState().clear();
            router.push(`/orders/${data.orderId}`);
          } catch (err) {
            setError(String(err));
            setLoading(false);
          }
        },
        modal: {
          ondismiss: () => setLoading(false),
        },
      });
      rzp.open();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setLoading(false);
    }
  }

  const ctaLabel =
    payment === "upi"
      ? `Pay ${formatINR(total)} via UPI`
      : `Confirm COD order · ${formatINR(total)}`;

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
            <div className="flex justify-between items-center">
              <div>
                <div className="font-semibold text-brand-ink">
                  Order summary
                </div>
                <div className="text-sm text-brand-ink-soft">
                  {count} {count === 1 ? "item" : "items"}
                </div>
              </div>
              <div className="font-semibold text-brand-ink">
                {formatINR(subtotal)}
              </div>
            </div>
          </div>

          <div className="mt-6 bg-white rounded-2xl border border-brand-line p-5">
            <h2 className="font-semibold text-brand-ink">
              Where should we ship?
            </h2>
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
              {pincode.length === 6 && (
                <div className="text-success text-sm">
                  Delivered to {pincode} by Tue, 28 May
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
            <div className="flex justify-between border-t border-brand-line pt-3 mt-3 font-bold text-lg">
              <span>Total</span>
              <span>{formatINR(total)}</span>
            </div>
          </div>

          <div className="sticky bottom-0 mt-6 -mx-4 px-4 py-3 bg-brand-cream/95 backdrop-blur lg:static lg:bg-transparent lg:mx-0 lg:px-0 lg:py-0">
            {error && (
              <div className="mb-3 rounded-lg border border-brand-red bg-brand-red-soft px-4 py-3 text-sm text-brand-red">
                {error}
              </div>
            )}
            <PayButton
              label={loading ? "Placing order..." : ctaLabel}
              onClick={handlePlaceOrder}
              disabled={loading}
              loading={loading}
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
