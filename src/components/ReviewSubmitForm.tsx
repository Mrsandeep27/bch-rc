"use client";

import { useState } from "react";
import Image from "next/image";
import { Star, Check } from "lucide-react";

type Props = {
  orderId: string;
  siteId: string;
  skuId: string;
  skuName: string;
  skuImage: string;
};

export default function ReviewSubmitForm({
  orderId,
  siteId,
  skuId,
  skuName,
  skuImage,
}: Props) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerCity, setCustomerCity] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (rating < 1) {
      setError("Please pick a star rating.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const r = await fetch("/api/reviews/submit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          siteId,
          orderId,
          skuId,
          rating,
          title: title.trim() || undefined,
          body: body.trim() || undefined,
          customerName: customerName.trim() || undefined,
          customerCity: customerCity.trim() || undefined,
        }),
      });
      const data = await r.json();
      if (!r.ok || !data.ok) {
        setError(data.reason ?? "Couldn't save the review. Try again?");
        return;
      }
      setSubmitted(true);
    } catch {
      setError("Couldn't reach the server. Try again?");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="bg-white border border-success/30 bg-success/5 rounded-2xl p-5 flex items-start gap-3">
        <span className="shrink-0 w-9 h-9 rounded-full bg-success/15 text-success flex items-center justify-center">
          <Check size={18} />
        </span>
        <div>
          <div className="font-semibold text-brand-ink">
            Thanks — saved.
          </div>
          <p className="text-sm text-brand-ink-soft mt-1">
            We&apos;ll moderate it in a day or two; once approved it shows
            up on the {skuName} page.
          </p>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="bg-white border border-brand-line rounded-2xl p-5 space-y-4"
    >
      <header className="flex items-center gap-3">
        <div className="relative w-14 h-14 rounded-lg overflow-hidden bg-brand-cream flex-shrink-0">
          <Image
            src={skuImage}
            alt={skuName}
            fill
            sizes="56px"
            className="object-contain p-1"
          />
        </div>
        <div>
          <div className="font-semibold text-brand-ink leading-tight">
            {skuName}
          </div>
          <div className="text-xs text-brand-ink-soft mt-0.5">
            Order {orderId}
          </div>
        </div>
      </header>

      <div>
        <label className="block text-sm font-medium text-brand-ink mb-1.5">
          Your rating
        </label>
        <div
          className="inline-flex items-center gap-1"
          role="radiogroup"
          aria-label={`Rate ${skuName}`}
        >
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={rating === n}
              onMouseEnter={() => setHover(n)}
              onMouseLeave={() => setHover(0)}
              onClick={() => setRating(n)}
              className="p-1"
            >
              <Star
                size={28}
                className={
                  n <= (hover || rating)
                    ? "fill-amber-400 text-amber-400"
                    : "text-brand-line"
                }
              />
            </button>
          ))}
        </div>
      </div>

      <div>
        <label
          htmlFor={`title-${skuId}`}
          className="block text-sm font-medium text-brand-ink mb-1.5"
        >
          Headline <span className="text-brand-ink-soft">(optional)</span>
        </label>
        <input
          id={`title-${skuId}`}
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value.slice(0, 120))}
          placeholder='e.g. "Gifted it to my brother — he won&apos;t stop drifting"'
          className="w-full px-3 py-2.5 border border-brand-line rounded-lg text-sm focus:outline-none focus:border-brand-red"
        />
      </div>

      <div>
        <label
          htmlFor={`body-${skuId}`}
          className="block text-sm font-medium text-brand-ink mb-1.5"
        >
          The honest version{" "}
          <span className="text-brand-ink-soft">(optional)</span>
        </label>
        <textarea
          id={`body-${skuId}`}
          value={body}
          onChange={(e) => setBody(e.target.value.slice(0, 2000))}
          placeholder="What surprised you? What floors does it drift on? Would you gift it again?"
          rows={4}
          className="w-full px-3 py-2.5 border border-brand-line rounded-lg text-sm focus:outline-none focus:border-brand-red resize-none"
        />
        <p className="text-[11px] text-brand-ink-soft mt-1">
          Photos help — they convert more than text. WhatsApp them to us;
          we&apos;ll attach them after moderation.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label
            htmlFor={`name-${skuId}`}
            className="block text-xs font-medium text-brand-ink-soft mb-1.5"
          >
            Display name
          </label>
          <input
            id={`name-${skuId}`}
            type="text"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value.slice(0, 80))}
            placeholder='e.g. "Rohan K."'
            className="w-full px-3 py-2 border border-brand-line rounded-lg text-sm focus:outline-none focus:border-brand-red"
          />
        </div>
        <div>
          <label
            htmlFor={`city-${skuId}`}
            className="block text-xs font-medium text-brand-ink-soft mb-1.5"
          >
            City
          </label>
          <input
            id={`city-${skuId}`}
            type="text"
            value={customerCity}
            onChange={(e) => setCustomerCity(e.target.value.slice(0, 80))}
            placeholder="e.g. Pune"
            className="w-full px-3 py-2 border border-brand-line rounded-lg text-sm focus:outline-none focus:border-brand-red"
          />
        </div>
      </div>

      {error && (
        <p className="text-sm text-brand-red font-medium">{error}</p>
      )}

      <button
        type="submit"
        disabled={submitting || rating < 1}
        className="w-full bg-brand-red hover:bg-brand-red-hover text-white py-3 rounded-full font-semibold text-sm disabled:opacity-50"
      >
        {submitting ? "Saving…" : "Submit review"}
      </button>
    </form>
  );
}
