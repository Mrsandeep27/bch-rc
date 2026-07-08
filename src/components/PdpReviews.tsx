"use client";

import { useRef, useState } from "react";
import { CheckCircle2, ImagePlus, PencilLine, ShieldCheck, Star, X } from "lucide-react";
import { Stars, StarInput } from "@/components/Stars";
import { cn } from "@/lib/utils";

/**
 * Downscale + re-encode a picked image to WebP on the client BEFORE upload.
 * Keeps stored photos small (fast PDP, cheap storage) without visible quality
 * loss: longest side capped at 1400px, WebP quality 0.82. Falls back to the
 * original file if the browser can't decode it.
 */
async function compressImage(file: File): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const MAX = 1400;
    let { width, height } = bitmap;
    if (width > MAX || height > MAX) {
      const scale = MAX / Math.max(width, height);
      width = Math.round(width * scale);
      height = Math.round(height * scale);
    }
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/webp", 0.82),
    );
    return blob ?? file;
  } catch {
    return file;
  }
}

export type PdpReviewItem = {
  id: string;
  rating: number;
  title: string | null;
  body: string | null;
  customerName: string | null;
  customerCity: string | null;
  verifiedPurchase: boolean;
  images: string[];
  createdAt: string;
};

export type PdpReviewData = {
  count: number;
  averageRating: number;
  histogram: Record<1 | 2 | 3 | 4 | 5, number>;
};

/**
 * Brand-baseline star distribution, used ONLY until a product gathers its own
 * approved reviews (so the histogram never renders as five empty bars). Skewed
 * to the top to average ~the brand rating; the moment real reviews exist they
 * replace this entirely. Deterministic (no randomness) so SSR and client match.
 */
function baselineHistogram(
  total: number,
  rating: number,
): Record<1 | 2 | 3 | 4 | 5, number> {
  // Skew the distribution to the given rating: the higher the rating, the more
  // 5★ weight. p5 tracks the rating; the remainder spreads across 4→1.
  const p5 = Math.min(0.95, Math.max(0.5, rating - 3.9));
  const rest = 1 - p5;
  const weights: Record<1 | 2 | 3 | 4 | 5, number> = {
    5: p5,
    4: rest * 0.7,
    3: rest * 0.18,
    2: rest * 0.08,
    1: rest * 0.04,
  };
  const h: Record<1 | 2 | 3 | 4 | 5, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let assigned = 0;
  for (const s of [1, 2, 3, 4, 5] as const) {
    h[s] = Math.round(total * weights[s]);
    assigned += h[s];
  }
  h[5] += total - assigned; // absorb rounding drift into the top bucket
  return h;
}

/**
 * Per-product reviews block (Amazon / Meesho style): a rating summary with a
 * 5-bar histogram, the approved review list, and a verified-buyer submission
 * form. Submission is gated by a real order id (see /api/reviews/submit) so
 * only people who actually bought can review — the same trust model the big
 * marketplaces use. New reviews land in a moderation queue (status "pending").
 */
export function PdpReviews({
  siteId,
  skuId,
  reviews,
  data,
  fallbackRating,
  fallbackCount,
}: {
  siteId: string;
  skuId: string;
  reviews: PdpReviewItem[];
  data: PdpReviewData;
  fallbackRating: number;
  fallbackCount: number;
}) {
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [orderId, setOrderId] = useState("");
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState<"idle" | "saving" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const MAX_PHOTOS = 5;

  async function onFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []);
    e.target.value = ""; // allow re-picking the same file
    if (!picked.length) return;
    setUploading(true);
    setError(null);
    for (const file of picked.slice(0, MAX_PHOTOS - images.length)) {
      try {
        const blob = await compressImage(file);
        const fd = new FormData();
        fd.append("file", blob, "review.webp");
        const res = await fetch("/api/reviews/upload", { method: "POST", body: fd });
        const json = await res.json().catch(() => ({}));
        if (res.ok && json.ok) {
          setImages((prev) => [...prev, json.url]);
        } else {
          setError(json.reason || "Couldn't upload that photo.");
        }
      } catch {
        setError("Couldn't upload that photo.");
      }
    }
    setUploading(false);
  }

  const hasReal = data.count > 0;
  const shownRating = hasReal ? data.averageRating : fallbackRating;
  // Fall back to a brand-baseline distribution so the bars never render empty.
  const shownCount = hasReal ? data.count : fallbackCount;
  const shownHistogram = hasReal
    ? data.histogram
    : baselineHistogram(fallbackCount, fallbackRating);
  const maxBar = Math.max(1, ...Object.values(shownHistogram));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("saving");
    setError(null);
    try {
      const res = await fetch("/api/reviews/submit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          siteId,
          skuId,
          orderId: orderId.trim(),
          rating,
          title: title.trim() || undefined,
          body: body.trim() || undefined,
          customerName: name.trim() || undefined,
          customerCity: city.trim() || undefined,
          images: images.length ? images : undefined,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) {
        throw new Error(json.reason || "Couldn't submit your review.");
      }
      setStatus("done");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  return (
    <section id="reviews" className="mt-8 border-t border-brand-line pt-6 scroll-mt-24 sm:mt-12 sm:pt-8">
      <h2 className="font-display text-xl sm:text-2xl font-bold text-brand-ink">
        Ratings &amp; Reviews
      </h2>

      {/* Summary: number + stars BESIDE the histogram — one compact row on
          mobile too (no stacked full-width rating box). */}
      <div className="mt-3 flex items-center gap-4 sm:mt-4 sm:gap-6">
        <div className="flex shrink-0 flex-col items-center justify-center rounded-2xl bg-brand-cream px-4 py-3 text-center sm:min-w-[160px] sm:px-6 sm:py-4">
          <div className="font-display text-3xl font-bold text-brand-ink sm:text-4xl">
            {shownRating.toFixed(1)}
          </div>
          <Stars value={shownRating} size={14} className="mt-1" />
          <div className="mt-1 text-[10px] text-brand-ink-soft sm:text-xs">
            {shownCount.toLocaleString("en-IN")}{" "}
            {hasReal ? `verified review${data.count > 1 ? "s" : ""}` : "ratings"}
          </div>
        </div>

        <div className="min-w-0 flex-1 space-y-1 sm:space-y-1.5">
          {[5, 4, 3, 2, 1].map((star) => {
            const n = shownHistogram[star as 1 | 2 | 3 | 4 | 5] ?? 0;
            return (
              <div key={star} className="flex items-center gap-2 text-xs">
                <span className="w-3 text-brand-ink-soft">{star}</span>
                <Star size={11} className="text-amber-400" fill="currentColor" strokeWidth={0} />
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-brand-line/60">
                  <div
                    className="h-full rounded-full bg-amber-400"
                    style={{ width: `${(n / maxBar) * 100}%` }}
                  />
                </div>
                <span className="w-6 text-right tabular-nums text-brand-ink-soft">{n}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Write-a-review CTA + form */}
      <div className="mt-4 sm:mt-6">
        {status === "done" ? (
          <div className="flex items-start gap-2 rounded-xl border border-success/30 bg-success/5 p-4 text-sm text-brand-ink">
            <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-success" />
            <div>
              <span className="font-semibold">Thanks for your review!</span> It&apos;s
              in the moderation queue and will appear once approved.
            </div>
          </div>
        ) : !open ? (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex items-center gap-2 rounded-full border border-brand-ink/15 bg-white px-5 py-2.5 text-sm font-semibold text-brand-ink transition-colors hover:border-brand-ink"
          >
            <PencilLine size={15} /> Write a review
          </button>
        ) : (
          <form onSubmit={submit} className="rounded-2xl border border-brand-line bg-white p-4 sm:p-5">
            <div className="flex items-center gap-2 text-xs font-medium text-brand-ink-soft">
              <ShieldCheck size={14} className="text-success" />
              Verified buyers only — enter the Order ID from your confirmation.
            </div>

            <div className="mt-3">
              <label className="text-xs font-semibold text-brand-ink">Your rating</label>
              <div className="mt-1">
                <StarInput value={rating} onChange={setRating} />
              </div>
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Field label="Order ID" required value={orderId} onChange={setOrderId} placeholder="PRC-XXXXXXXX" />
              <Field label="Your name" value={name} onChange={setName} placeholder="Shown with your review" />
              <Field label="City" value={city} onChange={setCity} placeholder="Optional" />
              <Field label="Headline" value={title} onChange={setTitle} placeholder="Sum it up in a line" />
            </div>

            <div className="mt-3">
              <label className="text-xs font-semibold text-brand-ink">Your review</label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={3}
                maxLength={2000}
                placeholder="How's the build, the drift, the delivery?"
                className="mt-1 w-full rounded-xl border border-brand-line px-3 py-2 text-sm outline-none focus:border-brand-ink"
              />
            </div>

            {/* Photo upload — compressed to WebP client-side before upload. */}
            <div className="mt-3">
              <label className="text-xs font-semibold text-brand-ink">
                Add photos <span className="font-normal text-brand-ink-soft">(optional)</span>
              </label>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                {images.map((url) => (
                  <div key={url} className="relative h-16 w-16 overflow-hidden rounded-lg border border-brand-line">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt="" className="h-full w-full object-cover" loading="lazy" />
                    <button
                      type="button"
                      onClick={() => setImages((prev) => prev.filter((u) => u !== url))}
                      aria-label="Remove photo"
                      className="absolute right-0.5 top-0.5 rounded-full bg-black/60 p-0.5 text-white hover:bg-black/80"
                    >
                      <X size={11} />
                    </button>
                  </div>
                ))}
                {images.length < MAX_PHOTOS && (
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                    className="flex h-16 w-16 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-brand-line text-brand-ink-soft transition-colors hover:border-brand-ink disabled:opacity-50"
                  >
                    <ImagePlus size={16} />
                    <span className="text-[9px] font-medium">{uploading ? "…" : "Add"}</span>
                  </button>
                )}
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  onChange={onFiles}
                  className="hidden"
                />
              </div>
            </div>

            {error && <p className="mt-2 text-sm text-brand-red">{error}</p>}

            <div className="mt-3 flex items-center gap-3">
              <button
                type="submit"
                disabled={status === "saving" || orderId.trim().length < 3}
                className="inline-flex items-center justify-center rounded-full bg-brand-red px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-red-hover disabled:opacity-50"
              >
                {status === "saving" ? "Submitting…" : "Submit review"}
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-sm font-medium text-brand-ink-soft hover:text-brand-ink"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Review list */}
      {reviews.length > 0 ? (
        <ul className="mt-6 space-y-4">
          {reviews.map((r) => (
            <li key={r.id} className="rounded-2xl border border-brand-line bg-white p-4">
              <div className="flex items-center gap-2">
                <Stars value={r.rating} size={14} />
                {r.verifiedPurchase && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-semibold text-success">
                    <ShieldCheck size={11} /> Verified
                  </span>
                )}
              </div>
              {r.title && <p className="mt-1.5 font-semibold text-brand-ink">{r.title}</p>}
              {r.body && <p className="mt-1 text-sm text-brand-ink-soft whitespace-pre-line">{r.body}</p>}
              {r.images?.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {r.images.map((url) => (
                    <a
                      key={url}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block h-16 w-16 overflow-hidden rounded-lg border border-brand-line"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt="Customer photo" className="h-full w-full object-cover transition-transform hover:scale-105" loading="lazy" />
                    </a>
                  ))}
                </div>
              )}
              <p className="mt-2 text-xs text-brand-ink-soft">
                {r.customerName || "PRC buyer"}
                {r.customerCity ? ` · ${r.customerCity}` : ""} ·{" "}
                {new Date(r.createdAt).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-6 text-sm text-brand-ink-soft">
          No reviews yet — be the first to review this model after your order arrives.
        </p>
      )}
    </section>
  );
}

/** Small labelled text input used across the review form. */
function Field({
  label,
  value,
  onChange,
  placeholder,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-brand-ink">
        {label}
        {required && <span className="text-brand-red"> *</span>}
      </span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(
          "mt-1 w-full rounded-xl border border-brand-line px-3 py-2 text-sm outline-none focus:border-brand-ink",
        )}
      />
    </label>
  );
}
