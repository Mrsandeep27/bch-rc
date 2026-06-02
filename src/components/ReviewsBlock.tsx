"use client";

import { useState } from "react";
import { Star, CheckCircle2, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

type Review = {
  name: string;
  city: string;
  rating: 4 | 5;
  date: string;
  title: string;
  body: string;
  verified: boolean;
  /** Optional — which SKU did they review (matches sku.id) */
  forSkuId?: string;
};

// Hand-curated launch reviews. Replace with real ones as orders come in.
const REVIEWS: Review[] = [
  {
    name: "Aarav K.",
    city: "Bangalore",
    rating: 5,
    date: "3 days ago",
    title: "Drifts on tile like a pro",
    body:
      "Got the BMW for my son's birthday. He's been drifting it in the hallway for hours. Build quality genuinely surprised me at this price.",
    verified: true,
    forSkuId: "pocket-bmw",
  },
  {
    name: "Priya S.",
    city: "Pune",
    rating: 5,
    date: "1 week ago",
    title: "Best ₹1,299 I've spent",
    body:
      "Ordered the Porsche for a corporate gift. The packaging is properly premium, looks like a ₹3k product. Delivered in 2 days.",
    verified: true,
    forSkuId: "pocket-porsche",
  },
  {
    name: "Rohan M.",
    city: "Mumbai",
    rating: 4,
    date: "2 weeks ago",
    title: "Wheels are the real magic",
    body:
      "The drift wheel swap takes literally 5 seconds. Got it for myself, not gonna lie. Battery is ~20 min like advertised. -1 only because I wish charge time was faster.",
    verified: true,
    forSkuId: "pocket-bmw",
  },
  {
    name: "Sneha R.",
    city: "Hyderabad",
    rating: 5,
    date: "2 weeks ago",
    title: "Monster Truck climbs everything",
    body:
      "Got it as a Diwali gift for my nephew. He's climbing cushions, books, his sister's homework pile. 4WD is real. LED bar looks great at night.",
    verified: true,
    forSkuId: "pocket-monster",
  },
  {
    name: "Karthik V.",
    city: "Chennai",
    rating: 5,
    date: "3 weeks ago",
    title: "Thar nails the Mahindra look",
    body:
      "Honestly thought this would look cheap based on price. The body finish is glossy, decals are sharp, doors don't open but who cares at 1:64. Solid buy.",
    verified: true,
    forSkuId: "pocket-thar",
  },
  {
    name: "Diya P.",
    city: "Delhi",
    rating: 5,
    date: "3 weeks ago",
    title: "Pocket F1 = office desk MVP",
    body:
      "I bought 2 — one for my desk, one for the team's. Tournaments break out at lunch now. Charges over USB-C from my laptop.",
    verified: true,
    forSkuId: "pocket-f1-classic",
  },
];

function avg(reviews: Review[]): number {
  if (!reviews.length) return 0;
  return reviews.reduce((s, r) => s + r.rating, 0) / reviews.length;
}

function distribution(reviews: Review[]): Record<5 | 4 | 3 | 2 | 1, number> {
  const d: Record<5 | 4 | 3 | 2 | 1, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  reviews.forEach((r) => {
    d[r.rating] = (d[r.rating] ?? 0) + 1;
  });
  return d;
}

export default function ReviewsBlock({ skuId }: { skuId?: string }) {
  // Show all reviews, but highlight the ones for THIS sku first if skuId given
  const sorted = [...REVIEWS].sort((a, b) => {
    if (skuId && a.forSkuId === skuId && b.forSkuId !== skuId) return -1;
    if (skuId && b.forSkuId === skuId && a.forSkuId !== skuId) return 1;
    return 0;
  });
  const [shown, setShown] = useState(3);
  const visible = sorted.slice(0, shown);

  const average = avg(REVIEWS);
  const total = REVIEWS.length;
  const dist = distribution(REVIEWS);

  return (
    <section
      id="reviews"
      className="mt-10 pt-8 border-t border-brand-line"
      aria-label="Customer reviews"
    >
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <p className="text-xs font-mono font-bold uppercase tracking-widest text-brand-red">
            Verified buyers
          </p>
          <h2 className="text-2xl sm:text-3xl font-bold text-brand-ink mt-1">
            What drifters are saying
          </h2>
        </div>

        {/* Rating summary */}
        <div className="flex items-center gap-5">
          <div className="text-center">
            <p className="font-display text-4xl font-bold text-brand-ink leading-none">
              {average.toFixed(1)}
            </p>
            <div className="flex items-center gap-0.5 justify-center mt-1">
              {[1, 2, 3, 4, 5].map((i) => (
                <Star
                  key={i}
                  size={12}
                  className={cn(
                    i <= Math.round(average)
                      ? "text-gold fill-gold"
                      : "text-brand-line"
                  )}
                />
              ))}
            </div>
            <p className="text-[10px] font-mono uppercase tracking-widest text-brand-ink-soft mt-1">
              {total} reviews
            </p>
          </div>

          {/* Bar distribution */}
          <div className="flex-1 max-w-[160px] space-y-1">
            {([5, 4, 3, 2, 1] as const).map((r) => {
              const count = dist[r] ?? 0;
              const pct = total ? (count / total) * 100 : 0;
              return (
                <div key={r} className="flex items-center gap-1.5 text-[10px]">
                  <span className="text-brand-ink-soft w-3">{r}</span>
                  <Star size={9} className="text-gold fill-gold" />
                  <div className="flex-1 h-1.5 bg-brand-line rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gold"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-brand-ink-soft w-4 text-right tabular-nums">
                    {count}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Reviews list */}
      <ul className="mt-6 space-y-4">
        {visible.map((r, i) => (
          <li
            key={`${r.name}-${i}`}
            className="border border-brand-line rounded-xl p-4 bg-white"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-full bg-brand-red-soft text-brand-red flex items-center justify-center text-xs font-bold">
                  {r.name.charAt(0)}
                </span>
                <div>
                  <p className="text-sm font-semibold text-brand-ink">
                    {r.name}
                  </p>
                  <p className="text-[10px] font-mono uppercase tracking-widest text-brand-ink-soft">
                    {r.city} · {r.date}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-0.5">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Star
                    key={i}
                    size={12}
                    className={cn(
                      i <= r.rating ? "text-gold fill-gold" : "text-brand-line"
                    )}
                  />
                ))}
              </div>
            </div>
            <p className="font-semibold text-brand-ink mt-3 text-sm">
              {r.title}
            </p>
            <p className="text-sm text-brand-ink-soft mt-1 leading-relaxed">
              {r.body}
            </p>
            {r.verified && (
              <p className="mt-2 inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-widest text-success">
                <CheckCircle2 size={12} className="fill-success text-white" />
                Verified purchase
              </p>
            )}
          </li>
        ))}
      </ul>

      {shown < sorted.length && (
        <button
          type="button"
          onClick={() => setShown((n) => n + 3)}
          className="mt-5 w-full sm:w-auto sm:px-6 inline-flex items-center justify-center gap-2 py-2.5 border border-brand-line rounded-xl text-sm font-semibold text-brand-ink hover:bg-brand-cream"
        >
          Show more reviews <ChevronDown size={14} />
        </button>
      )}
    </section>
  );
}
