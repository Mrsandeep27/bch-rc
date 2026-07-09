import Image from "next/image";
import Link from "next/link";
import { Star } from "lucide-react";
import { and, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { reviews } from "@/db/schema";
import { requireAdmin } from "@/lib/admin-auth";
import { formatIST } from "@/lib/utils";
import { ReviewActions } from "./ReviewActions";

export const dynamic = "force-dynamic";

type Tab = "pending" | "approved" | "rejected";
const TABS: Tab[] = ["pending", "approved", "rejected"];

function Stars({ rating }: { rating: number }) {
  const r = Math.max(0, Math.min(5, rating));
  return (
    <span className="inline-flex items-center gap-0.5" title={`${r} of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          size={14}
          className={n <= r ? "text-gold fill-gold" : "text-brand-line"}
        />
      ))}
    </span>
  );
}

export default async function AdminReviews({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const ctx = await requireAdmin();
  const sp = await searchParams;
  const tab: Tab = TABS.includes(sp.tab as Tab) ? (sp.tab as Tab) : "pending";

  // Admin sees reviews for their sites plus legacy rows with a null site_id.
  const scope = or(
    inArray(reviews.siteId, ctx.siteIds),
    isNull(reviews.siteId),
  );

  const [stats, rows] = await Promise.all([
    db
      .select({
        pending: sql<number>`count(*) filter (where ${reviews.status} = 'pending')::int`,
        approved: sql<number>`count(*) filter (where ${reviews.status} = 'approved')::int`,
        rejected: sql<number>`count(*) filter (where ${reviews.status} = 'rejected')::int`,
        avgApproved: sql<number>`coalesce(round(avg(${reviews.rating}) filter (where ${reviews.status} = 'approved'), 1), 0)::float`,
        withPhotos: sql<number>`count(*) filter (where array_length(${reviews.images}, 1) > 0)::int`,
      })
      .from(reviews)
      .where(scope)
      .then((r) => r[0]),
    db
      .select()
      .from(reviews)
      .where(and(scope, eq(reviews.status, tab)))
      .orderBy(desc(reviews.createdAt))
      .limit(100),
  ]);

  const pending = stats?.pending ?? 0;
  const approved = stats?.approved ?? 0;
  const rejected = stats?.rejected ?? 0;
  const avgApproved = stats?.avgApproved ?? 0;
  const withPhotos = stats?.withPhotos ?? 0;
  const tabCount: Record<Tab, number> = {
    pending,
    approved,
    rejected,
  };

  return (
    <div className="space-y-3 sm:space-y-6">
      <div>
        <h1 className="font-display text-lg sm:text-3xl font-bold text-brand-ink">
          Reviews
        </h1>
        <p className="text-sm text-brand-ink-soft mt-1">
          Moderate customer reviews. Approved reviews show on the storefront;
          pending and rejected never do.
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
        <div className="bg-white rounded-2xl border border-brand-line p-3 sm:p-5">
          <div className="text-[11px] font-mono font-bold uppercase tracking-widest text-brand-ink-soft">
            Pending
          </div>
          <div
            className={`font-display text-xl sm:text-3xl font-bold mt-2 tabular-nums ${
              pending > 0 ? "text-gold" : "text-brand-ink"
            }`}
          >
            {pending}
          </div>
          <div className="text-xs text-brand-ink-soft mt-1">awaiting you</div>
        </div>
        <div className="bg-white rounded-2xl border border-brand-line p-3 sm:p-5">
          <div className="text-[11px] font-mono font-bold uppercase tracking-widest text-brand-ink-soft">
            Approved
          </div>
          <div className="font-display text-xl sm:text-3xl font-bold text-brand-ink mt-2 tabular-nums">
            {approved}
          </div>
          <div className="text-xs text-brand-ink-soft mt-1">live on PDPs</div>
        </div>
        <div className="bg-white rounded-2xl border border-brand-line p-3 sm:p-5">
          <div className="text-[11px] font-mono font-bold uppercase tracking-widest text-brand-ink-soft">
            Avg rating
          </div>
          <div className="font-display text-xl sm:text-3xl font-bold text-brand-ink mt-2 tabular-nums">
            {avgApproved.toFixed(1)}★
          </div>
          <div className="text-xs text-brand-ink-soft mt-1">of approved</div>
        </div>
        <div className="bg-white rounded-2xl border border-brand-line p-3 sm:p-5">
          <div className="text-[11px] font-mono font-bold uppercase tracking-widest text-brand-ink-soft">
            With photos
          </div>
          <div className="font-display text-xl sm:text-3xl font-bold text-brand-ink mt-2 tabular-nums">
            {withPhotos}
          </div>
          <div className="text-xs text-brand-ink-soft mt-1">customer UGC</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
        {TABS.map((t) => (
          <Link
            key={t}
            href={`/admin/reviews?tab=${t}`}
            className={`shrink-0 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold capitalize transition-colors ${
              t === tab
                ? "bg-brand-ink text-white"
                : "bg-white border border-brand-line text-brand-ink-soft hover:text-brand-ink"
            }`}
          >
            {t}
            <span
              className={`tabular-nums text-xs ${
                t === tab ? "text-white/70" : "text-brand-ink-soft"
              }`}
            >
              {tabCount[t]}
            </span>
          </Link>
        ))}
      </div>

      {/* Queue */}
      <div className="bg-white rounded-2xl border border-brand-line overflow-hidden">
        {rows.length === 0 ? (
          <p className="px-5 py-10 sm:py-16 text-center text-sm text-brand-ink-soft">
            {tab === "pending"
              ? "Nothing awaiting moderation. ✅"
              : `No ${tab} reviews.`}
          </p>
        ) : (
          <ul className="divide-y divide-brand-line">
            {rows.map((r) => (
              <li key={r.id} className="px-3 py-3 sm:px-5 sm:py-4">
                <div className="flex items-start justify-between gap-3 sm:gap-4 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Stars rating={r.rating} />
                      <span className="font-semibold text-brand-ink">
                        {r.customerName ?? "Anonymous"}
                      </span>
                      {r.verifiedPurchase && (
                        <span className="text-[10px] font-mono uppercase tracking-widest font-semibold px-2 py-0.5 rounded-full bg-success/10 text-success">
                          Verified
                        </span>
                      )}
                      {r.skuId && (
                        <span className="text-[10px] font-mono uppercase tracking-widest text-brand-ink-soft border border-brand-line px-1.5 py-0.5 rounded">
                          {r.skuId}
                        </span>
                      )}
                    </div>
                    {r.title && (
                      <div className="font-semibold text-brand-ink mt-2">
                        {r.title}
                      </div>
                    )}
                    {r.body && (
                      <p className="text-sm text-brand-ink mt-1 max-w-2xl">
                        {r.body}
                      </p>
                    )}
                    <div className="text-xs text-brand-ink-soft mt-1.5">
                      {formatIST(r.createdAt)}
                      {r.customerCity ? ` · ${r.customerCity}` : ""}
                      {r.images.length > 0
                        ? ` · ${r.images.length} photo${r.images.length === 1 ? "" : "s"}`
                        : ""}
                    </div>
                    {r.images.length > 0 && (
                      <div className="mt-2.5 flex flex-wrap items-center gap-2">
                        {r.images.map((url) => (
                          <a
                            key={url}
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Open full image in a new tab"
                            className="relative h-14 w-14 sm:h-16 sm:w-16 overflow-hidden rounded-lg border border-brand-line bg-brand-cream transition-transform hover:scale-105"
                          >
                            <Image
                              src={url}
                              alt="Customer review photo"
                              fill
                              sizes="64px"
                              className="object-cover"
                            />
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                  <ReviewActions id={r.id} status={r.status} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
