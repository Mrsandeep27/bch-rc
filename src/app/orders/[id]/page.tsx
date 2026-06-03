/**
 * Order success page — shown after Razorpay verify succeeds or COD confirms.
 * Public-safe (no PII beyond masked phone). Reads from /api/orders/[id].
 */

import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { CheckCircle2, Package } from "lucide-react";
import { eq } from "drizzle-orm";
import { AnnouncementBar } from "@/components/AnnouncementBar";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { WhatsAppIcon } from "@/components/BrandIcons";
import { THEME } from "@/lib/theme";
import { waLink } from "@/lib/config";
import { formatINR } from "@/lib/utils";
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
  const items = order.items as OrderItem[];
  const shippingAddr = order.shippingAddress as {
    city?: string;
    pincode?: string;
    phone?: string;
  };
  const maskedPhone = shippingAddr?.phone
    ? `••••• ${String(shippingAddr.phone).slice(-4)}`
    : null;

  return (
    <>
      <AnnouncementBar />
      <Header />

      <main className="flex-1 bg-brand-cream">
        <section className="max-w-2xl mx-auto px-4 py-8 sm:py-12">
          {/* Success header */}
          <div className="bg-white rounded-2xl border border-brand-line p-6 sm:p-8 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-success/10 text-success mb-4">
              <CheckCircle2 size={32} />
            </div>
            <h1 className="font-display text-3xl sm:text-4xl font-bold text-brand-ink">
              {isCod ? "Order confirmed!" : "Payment successful!"}
            </h1>
            <p className="text-brand-ink-soft mt-2">
              {isCod
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

            <p className="text-xs text-brand-ink-soft mt-4">
              Save this — you'll need it to track or claim a replacement.
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
