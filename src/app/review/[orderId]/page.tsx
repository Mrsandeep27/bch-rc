/**
 * R01 — verified-purchase review submit page.
 *
 * URL: /review/PRC-XXXXXXXX — link is sent in the post-delivery WhatsApp
 * + email. The page reads the order ID from the path; the form lists
 * every SKU in that order so a multi-SKU buyer can review each one in
 * one visit. Submission goes through /api/reviews/submit which calls
 * submitReview() with the verified-purchase gate.
 *
 * If the order doesn't exist or hasn't shipped yet, the page shows a
 * friendly "your link will work after delivery" state instead of
 * exposing the order's existence to drive-by traffic.
 */

import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { AnnouncementBar } from "@/components/AnnouncementBar";
import ReviewSubmitForm from "@/components/ReviewSubmitForm";
import { db } from "@/db";
import { orders } from "@/db/schema";

type OrderItem = {
  skuId: string;
  name: string;
  image: string | null;
  qty: number;
};

const REVIEWABLE_STATUS = new Set([
  "DELIVERED",
  "SHIPPED",
  "PACKED",
  "PAID",
]);

async function loadOrder(orderId: string) {
  const [order] = await db
    .select({
      id: orders.id,
      status: orders.status,
      items: orders.items,
      siteId: orders.siteId,
    })
    .from(orders)
    .where(eq(orders.id, orderId));
  return order ?? null;
}

export const metadata = {
  title: "Leave a review",
  description: "Tell the next buyer what to expect.",
  robots: { index: false, follow: false },
};

export default async function ReviewPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  const order = await loadOrder(orderId);
  if (!order) notFound();

  const reviewable = REVIEWABLE_STATUS.has(order.status);
  const items = (order.items as OrderItem[]) ?? [];

  return (
    <>
      <AnnouncementBar />
      <Header />
      <main className="flex-1 bg-brand-cream">
        <div className="max-w-2xl mx-auto px-4 py-8 sm:py-12">
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-brand-ink">
            Tell the next buyer what to expect.
          </h1>
          <p className="text-sm text-brand-ink-soft mt-2">
            Your review goes through a quick moderation before it appears on
            the SKU page. Photos help — they convert more than text.
          </p>

          {!reviewable ? (
            <div className="mt-6 bg-white border border-brand-line rounded-2xl p-5">
              <p className="text-sm text-brand-ink">
                Your review link will unlock once the courier marks the
                order as delivered. Hang tight — we&apos;ll WhatsApp you the
                same link when it&apos;s ready.
              </p>
            </div>
          ) : items.length === 0 ? (
            <div className="mt-6 bg-white border border-brand-line rounded-2xl p-5">
              <p className="text-sm text-brand-ink">
                We couldn&apos;t find any items on this order. WhatsApp
                support so we can sort it out.
              </p>
            </div>
          ) : (
            <div className="mt-6 space-y-4">
              {items.map((item) => (
                <ReviewSubmitForm
                  key={item.skuId}
                  orderId={order.id}
                  siteId={order.siteId}
                  skuId={item.skuId}
                  skuName={item.name}
                  skuImage={item.image ?? "/og-image.jpg"}
                />
              ))}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
