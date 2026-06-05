import { Star, ShieldCheck } from "lucide-react";
import {
  getApprovedReviewsForSku,
  getReviewAggregateForSku,
  type StoreReview,
} from "@/lib/reviews";

function Stars({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <span
      className="inline-flex items-center gap-0.5"
      aria-label={`${rating} out of 5 stars`}
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          size={size}
          className={
            n <= Math.round(rating)
              ? "fill-amber-400 text-amber-400"
              : "text-brand-line"
          }
          aria-hidden
        />
      ))}
    </span>
  );
}

function ReviewCard({ r }: { r: StoreReview }) {
  const dateText = new Date(r.createdAt).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  return (
    <article className="border border-brand-line rounded-xl p-4 bg-white">
      <header className="flex items-center justify-between gap-3 flex-wrap">
        <Stars rating={r.rating} />
        {r.verifiedPurchase && (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-success">
            <ShieldCheck size={12} aria-hidden />
            Verified Purchase
          </span>
        )}
      </header>
      {r.title && (
        <h4 className="mt-2 font-semibold text-brand-ink text-sm sm:text-base">
          {r.title}
        </h4>
      )}
      {r.body && (
        <p className="mt-1.5 text-sm text-brand-ink-soft leading-relaxed whitespace-pre-line">
          {r.body}
        </p>
      )}
      <footer className="mt-3 text-[11px] font-mono uppercase tracking-widest text-brand-ink-soft">
        — {r.customerName ?? "Verified buyer"}
        {r.customerCity ? `, ${r.customerCity}` : ""} · {dateText}
      </footer>
    </article>
  );
}

/**
 * X06 — server component. Reads approved reviews + aggregate for the
 * SKU and renders the PDP reviews block. Empty state ("Be the first to
 * review this SKU") shows when no reviews exist, with a soft hint that
 * sends DELIVERED buyers to /review/[orderId] from their order email.
 */
export default async function PdpReviews({
  siteId,
  skuId,
}: {
  siteId: string;
  skuId: string;
}) {
  const [agg, reviewList] = await Promise.all([
    getReviewAggregateForSku(siteId, skuId),
    getApprovedReviewsForSku(siteId, skuId, 30),
  ]);

  return (
    <section
      id="reviews"
      aria-label="Customer reviews"
      className="max-w-3xl mx-auto px-4 py-8 sm:py-12"
    >
      <header className="flex items-end justify-between gap-3 flex-wrap">
        <h2 className="font-display text-xl sm:text-2xl font-bold text-brand-ink">
          What buyers say
        </h2>
        {agg.count > 0 && (
          <div className="flex items-center gap-2 text-sm">
            <Stars rating={agg.averageRating} size={16} />
            <span className="font-semibold text-brand-ink">
              {agg.averageRating}
            </span>
            <span className="text-brand-ink-soft">
              {agg.count} review{agg.count === 1 ? "" : "s"}
            </span>
          </div>
        )}
      </header>

      {agg.count === 0 ? (
        <div className="mt-5 bg-brand-cream border border-brand-line rounded-xl p-5 text-center">
          <p className="text-sm font-medium text-brand-ink">
            No reviews yet — be the first to drift this one.
          </p>
          <p className="text-xs text-brand-ink-soft mt-1.5">
            Your delivery email includes a one-tap review link.
          </p>
        </div>
      ) : (
        <div className="mt-5 space-y-3">
          {reviewList.map((r) => (
            <ReviewCard key={r.id} r={r} />
          ))}
        </div>
      )}
    </section>
  );
}
