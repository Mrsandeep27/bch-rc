/**
 * Order success page — shown after Razorpay verify succeeds or COD confirms.
 * Public-safe (no PII beyond masked phone). Reads from /api/orders/[id].
 */

import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { CheckCircle2, Clock, Package, Receipt, Truck } from "lucide-react";
import { eq } from "drizzle-orm";
import { AnnouncementBar } from "@/components/AnnouncementBar";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { WhatsAppIcon } from "@/components/BrandIcons";
import { THEME } from "@/lib/theme";
import { waLink } from "@/lib/config";
import { formatINR } from "@/lib/utils";
import { resolveServiceability } from "@/lib/serviceability";
import { db } from "@/db";
import { orders } from "@/db/schema";

type OrderItem = {
  skuId: string;
  variantSlug: string | null;
  name: string;
  image: string | null;
  unitPriceInr: number;
  qty: number;
  lineTotalInr: number;
};

async function getOrder(id: string) {
  const [order] = await db.select().from(orders).where(eq(orders.id, id));
  return order ?? null;
}

export default async function OrderSuccessPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const order = await getOrder(id);
  if (!order) notFound();

  const isCod = order.paymentMethod === "COD";
  // Prepaid order whose capture hasn't landed yet (webhook lag). Don't claim
  // "Payment successful!" until the money is actually confirmed.
  const awaitingCapture = !isCod && order.paymentStatus !== "CAPTURED";
  // COD orders sit unverified until our team rings the customer to confirm
  // (kills prank orders). Don't claim "Order confirmed!" until that happens.
  const awaitingCodVerification =
    isCod && order.status === "PENDING_COD_VERIFICATION";
  const items = order.items as OrderItem[];
  const shippingAddr = order.shippingAddress as {
    city?: string;
    pincode?: string;
    phone?: string;
  };
  const maskedPhone = shippingAddr?.phone
    ? `••••• ${String(shippingAddr.phone).slice(-4)}`
    : null;
  const etaText = shippingAddr?.pincode
    ? resolveServiceability(shippingAddr.pincode).etaText
    : null;
  const paidAtText = order.paidAt
    ? new Date(order.paidAt).toLocaleString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : null;

  return (
    <>
      <AnnouncementBar />
      <Header />

      <main className="flex-1 bg-brand-cream">
        <section className="max-w-2xl mx-auto px-4 py-8 sm:py-12">
          {/* Success header */}
          <div className="bg-white rounded-2xl border border-brand-line p-6 sm:p-8 text-center">
            <div
              className={`inline-flex items-center justify-center w-16 h-16 rounded-full mb-4 ${
                awaitingCapture || awaitingCodVerification
                  ? "bg-gold/10 text-gold"
                  : "bg-success/10 text-success"
              }`}
            >
              {awaitingCapture || awaitingCodVerification ? (
                <Clock size={32} />
              ) : (
                <CheckCircle2 size={32} />
              )}
            </div>
            <h1 className="font-display text-3xl sm:text-4xl font-bold text-brand-ink">
              {awaitingCapture
                ? "Order received — confirming payment"
                : awaitingCodVerification
                  ? "Order received — we'll call to confirm"
                  : isCod
                    ? "Order confirmed!"
                    : "Payment successful!"}
            </h1>
            <p className="text-brand-ink-soft mt-2">
              {awaitingCapture
                ? "Your payment is being confirmed by the bank — this usually takes a few seconds. We've saved your order; refresh to see the latest status."
                : awaitingCodVerification
                  ? "Our team will ring you within 24 hrs to confirm before dispatch. Please pick up when we call from a Bangalore number."
                  : isCod
                    ? "We'll dispatch from Yelahanka in 24 hrs."
                    : "Thanks for your order. Dispatch from Yelahanka in 24 hrs."}
            </p>

            <div className="mt-6 inline-flex flex-col items-center gap-1 px-5 py-3 rounded-xl bg-brand-cream border border-brand-line">
              <span className="text-[10px] font-mono uppercase tracking-widest text-brand-ink-soft">
                Order ID
              </span>
              <span className="font-mono font-bold text-lg text-brand-ink">
                {order.id}
              </span>
            </div>

            {etaText && order.status !== "DELIVERED" && (
              <p className="mt-4 inline-flex items-center justify-center gap-1.5 text-sm text-brand-ink">
                <Truck size={15} className="text-brand-red" aria-hidden />
                Estimated delivery {etaText}
              </p>
            )}

            <p className="text-xs text-brand-ink-soft mt-4">
              Save this — you&apos;ll need it to track or claim a replacement.
            </p>
          </div>

          {/* Summary */}
          <div className="mt-6 bg-white rounded-2xl border border-brand-line p-5 sm:p-6">
            <h2 className="font-semibold text-brand-ink mb-4">Order summary</h2>
            <div className="space-y-3">
              {items.map((item, idx) => (
                <div
                  key={`${item.skuId}-${item.variantSlug ?? "default"}-${idx}`}
                  className="flex items-center gap-3"
                >
                  {item.image && (
                    <div className="relative w-16 h-16 shrink-0 rounded-lg overflow-hidden border border-brand-line bg-brand-cream">
                      <Image
                        src={item.image}
                        alt={item.name}
                        fill
                        sizes="64px"
                        className="object-cover"
                      />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-brand-ink truncate">
                      {item.name}
                    </div>
                    <div className="text-sm text-brand-ink-soft">
                      Qty {item.qty} · {formatINR(item.unitPriceInr)} each
                    </div>
                  </div>
                  <div className="font-semibold text-brand-ink">
                    {formatINR(item.lineTotalInr)}
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-brand-line mt-5 pt-4 space-y-1.5 text-sm text-brand-ink">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>{formatINR(order.subtotalInr)}</span>
              </div>
              <div className="flex justify-between">
                <span>Shipping</span>
                <span className={order.shippingInr === 0 ? "text-success" : ""}>
                  {order.shippingInr === 0
                    ? "FREE"
                    : formatINR(order.shippingInr)}
                </span>
              </div>
              {order.codFeeInr > 0 && (
                <div className="flex justify-between">
                  <span>COD fee</span>
                  <span>{formatINR(order.codFeeInr)}</span>
                </div>
              )}
              {order.discountInr > 0 && (
                <div className="flex justify-between text-success">
                  <span>Prepaid discount</span>
                  <span>-{formatINR(order.discountInr)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-base text-brand-ink pt-2 border-t border-brand-line mt-2">
                <span>Total {isCod ? "(pay on delivery)" : "paid"}</span>
                <span>{formatINR(order.totalInr)}</span>
              </div>
            </div>
          </div>

          {/* Payment receipt — gives the buyer a reconcilable reference. */}
          <div className="mt-6 bg-white rounded-2xl border border-brand-line p-5 sm:p-6">
            <div className="flex items-center gap-2 mb-3">
              <Receipt size={18} className="text-brand-red" />
              <h2 className="font-semibold text-brand-ink">Payment receipt</h2>
            </div>
            <dl className="text-sm space-y-1.5">
              <div className="flex justify-between gap-3">
                <dt className="text-brand-ink-soft">Method</dt>
                <dd className="text-brand-ink font-medium">
                  {isCod ? "Cash on Delivery" : "Paid online (UPI / card)"}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-brand-ink-soft">Status</dt>
                <dd
                  className={
                    awaitingCapture
                      ? "text-gold font-medium"
                      : "text-success font-medium"
                  }
                >
                  {isCod
                    ? "To be collected on delivery"
                    : awaitingCapture
                      ? "Confirming…"
                      : "Paid"}
                </dd>
              </div>
              {!isCod && order.razorpayPaymentId && (
                <div className="flex justify-between gap-3">
                  <dt className="text-brand-ink-soft">Transaction ref</dt>
                  <dd className="text-brand-ink font-mono text-xs break-all text-right">
                    {order.razorpayPaymentId}
                  </dd>
                </div>
              )}
              {paidAtText && !isCod && (
                <div className="flex justify-between gap-3">
                  <dt className="text-brand-ink-soft">Paid on</dt>
                  <dd className="text-brand-ink">{paidAtText}</dd>
                </div>
              )}
              <div className="flex justify-between gap-3 border-t border-brand-line pt-2 mt-2 font-semibold">
                <dt className="text-brand-ink">
                  {isCod ? "Amount due" : "Amount paid"}
                </dt>
                <dd className="text-brand-ink">{formatINR(order.totalInr)}</dd>
              </div>
            </dl>
          </div>

          {/* Ships to */}
          {(shippingAddr?.city || shippingAddr?.pincode) && (
            <div className="mt-6 bg-white rounded-2xl border border-brand-line p-5 sm:p-6">
              <div className="flex items-center gap-2 mb-3">
                <Package size={18} className="text-brand-red" />
                <h2 className="font-semibold text-brand-ink">Shipping to</h2>
              </div>
              <p className="text-sm text-brand-ink-soft">
                {shippingAddr.city} · {shippingAddr.pincode}
              </p>
              {maskedPhone && (
                <p className="text-sm text-brand-ink-soft mt-1">
                  Contact: {maskedPhone}
                </p>
              )}
            </div>
          )}

          {/* CTAs */}
          <div className="mt-6 flex flex-col sm:flex-row gap-3">
            <Link
              href={`/track?id=${order.id}`}
              className="flex-1 inline-flex items-center justify-center gap-2 bg-brand-ink text-white px-5 py-3 rounded-xl font-semibold hover:bg-brand-ink-soft transition-colors"
            >
              <Package size={16} /> Track order
            </Link>
            <a
              href={waLink(
                `Hi, I just placed order ${order.id}. Quick question:`,
              )}
              target="_blank"
              rel="noopener"
              className="flex-1 inline-flex items-center justify-center gap-2 bg-whatsapp-green text-white px-5 py-3 rounded-xl font-semibold hover:bg-whatsapp-green-hover transition-colors"
            >
              <WhatsAppIcon size={16} /> WhatsApp us
            </a>
          </div>

          <div className="mt-8 text-center">
            <Link
              href="/"
              className="text-sm text-brand-ink-soft hover:text-brand-ink underline-offset-4 hover:underline"
            >
              ← Back to {THEME.brandName}
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
