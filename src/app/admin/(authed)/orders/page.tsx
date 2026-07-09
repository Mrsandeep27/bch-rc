import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  Package,
  Plus,
  Search,
} from "lucide-react";
import { and, desc, eq, inArray, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { orders } from "@/db/schema";
import { requireAdmin } from "@/lib/admin-auth";
import { formatINR, formatIST } from "@/lib/utils";

// Status groupings driven by the WhatsApp brief:
//   - LIVE_STATUSES: paid orders + confirmed COD + anything in fulfilment.
//                    These are the ones the operator acts on every day.
//   - PENDING_STATUSES: UPI carts that started checkout but never captured.
//                       Useful for retry-emails / abandonment follow-up.
//   - FAILED_STATUSES: terminal-unhappy. Manual follow-up bucket.
const LIVE_STATUSES = ["PAID", "PACKED", "SHIPPED", "DELIVERED"] as const;
// PENDING (prepaid that opened Razorpay but hasn't captured) lives here
// alongside PENDING_COD_VERIFICATION (COD waiting for the /cod operator to
// call + confirm). Both are pre-fulfilment states; lumping them in the same
// bucket keeps the admin counts honest.
const PENDING_STATUSES = ["PENDING", "PENDING_COD_VERIFICATION"] as const;
const FAILED_STATUSES = [
  "CANCELLED",
  "FAILED",
  "ABANDONED",
  "RETURNED",
  "REFUNDED",
] as const;

type View = "live" | "pending" | "failed" | "manual" | "all";

const PAGE_SIZE = 50;

export default async function AdminOrdersList({
  searchParams,
}: {
  searchParams: Promise<{
    view?: string;
    q?: string;
    page?: string;
  }>;
}) {
  const ctx = await requireAdmin();
  const params = await searchParams;

  // 1-based page. Anything non-numeric / < 1 falls back to page 1.
  const page = Math.max(1, Math.floor(Number(params.page)) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  const view: View =
    params.view === "pending"
      ? "pending"
      : params.view === "failed"
        ? "failed"
        : params.view === "manual"
          ? "manual"
          : params.view === "all"
            ? "all"
            : "live";

  const q = (params.q ?? "").trim();

  const visibleSiteIds = ctx.siteIds;

  // Bucket counts come from a single grouped query, NOT three separate
  // SELECTs — same wall-clock, all four buttons accurate regardless of
  // which view is active.
  const bucketRows = await db
    .select({
      status: orders.status,
      count: sql<number>`count(*)::int`,
    })
    .from(orders)
    .where(inArray(orders.siteId, visibleSiteIds))
    .groupBy(orders.status);

  const counts = { live: 0, pending: 0, failed: 0, manual: 0, all: 0 };
  for (const row of bucketRows) {
    counts.all += row.count;
    if ((LIVE_STATUSES as readonly string[]).includes(row.status))
      counts.live += row.count;
    else if ((PENDING_STATUSES as readonly string[]).includes(row.status))
      counts.pending += row.count;
    else if ((FAILED_STATUSES as readonly string[]).includes(row.status))
      counts.failed += row.count;
  }

  // Manual orders count — cuts across status, so it's a separate query.
  const [{ count: manualCount }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(orders)
    .where(
      and(
        inArray(orders.siteId, visibleSiteIds),
        eq(orders.createdVia, "ADMIN_MANUAL"),
      ),
    );
  counts.manual = manualCount;

  // Build the filter list:
  //   - always: scope to the admin's sites
  //   - if view ≠ all: scope to that view's status set
  //   - if q: match order id OR a field inside the shipping_address JSONB.
  //           Drizzle has no first-class JSONB helper, so we use raw SQL via
  //           `sql` template — parameterised, no string interpolation.
  const conditions = [inArray(orders.siteId, visibleSiteIds)];
  if (view === "live")
    conditions.push(inArray(orders.status, [...LIVE_STATUSES]));
  else if (view === "pending")
    conditions.push(inArray(orders.status, [...PENDING_STATUSES]));
  else if (view === "failed")
    conditions.push(inArray(orders.status, [...FAILED_STATUSES]));
  else if (view === "manual")
    conditions.push(eq(orders.createdVia, "ADMIN_MANUAL"));
  // view === "all" → no status filter
  if (q) {
    const like = `%${q}%`;
    conditions.push(
      or(
        sql`${orders.id} ILIKE ${like}`,
        sql`${orders.shippingAddress}->>'fullName' ILIKE ${like}`,
        sql`${orders.shippingAddress}->>'email' ILIKE ${like}`,
        sql`${orders.shippingAddress}->>'phone' ILIKE ${like}`,
      )!,
    );
  }

  // Fetch PAGE_SIZE + 1 so we know whether a next page exists without a second
  // count query. The extra row (if any) is sliced off before rendering.
  const fetched = await db
    .select()
    .from(orders)
    .where(and(...conditions))
    .orderBy(desc(orders.placedAt))
    .limit(PAGE_SIZE + 1)
    .offset(offset);

  const hasNext = fetched.length > PAGE_SIZE;
  const rows = hasNext ? fetched.slice(0, PAGE_SIZE) : fetched;
  const hasPrev = page > 1;
  const rangeStart = rows.length === 0 ? 0 : offset + 1;
  const rangeEnd = offset + rows.length;

  return (
    <div className="space-y-3 sm:space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-xl sm:text-3xl font-bold text-brand-ink">
            Orders
          </h1>
          <p className="text-xs sm:text-sm text-brand-ink-soft mt-0.5 sm:mt-1">
            {q
              ? `Search results for "${q}" — showing ${rangeStart}–${rangeEnd}${
                  hasNext ? "+" : ""
                }`
              : `Showing ${rangeStart}–${rangeEnd} of ${counts[view]} ${view === "all" ? "total" : view}`}
          </p>
        </div>
        <Link
          href="/admin/orders/new"
          className="shrink-0 inline-flex items-center gap-1.5 bg-brand-red hover:bg-brand-red-hover text-white px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl text-xs sm:text-sm font-semibold"
        >
          <Plus size={14} />
          <span className="hidden sm:inline">New manual order</span>
          <span className="sm:hidden">New</span>
        </Link>
      </div>

      {/* Search bar — preserves the current view + site. Submitting an empty
          q clears the search. */}
      <form
        action="/admin/orders"
        method="GET"
        className="bg-white rounded-2xl border border-brand-line p-1.5 flex items-center gap-1.5"
      >
        {view !== "live" && <input type="hidden" name="view" value={view} />}
        <Search size={16} className="text-brand-ink-soft ml-2 shrink-0" />
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Search by order ID, name, phone, or email…"
          className="flex-1 min-w-0 px-2 py-1.5 sm:py-2 text-sm text-brand-ink placeholder:text-brand-ink-soft focus:outline-none bg-transparent"
        />
        {q && (
          <Link
            href={`/admin/orders${view !== "live" ? `?view=${view}` : ""}`}
            className="text-xs text-brand-ink-soft hover:text-brand-ink px-2"
          >
            Clear
          </Link>
        )}
        <button
          type="submit"
          aria-label="Search"
          className="bg-brand-ink text-white text-xs font-semibold uppercase tracking-widest px-2.5 py-2 sm:px-3 rounded-xl"
        >
          <Search size={14} className="sm:hidden" />
          <span className="hidden sm:inline">Search</span>
        </button>
      </form>

      {/* View tabs */}
      <div className="flex items-center gap-2 overflow-x-auto overflow-y-hidden no-scrollbar">
        <ViewChip
          href={buildHref({ view: "live" })}
          label="Live"
          sub="Paid + COD + in-fulfilment"
          count={counts.live}
          active={view === "live"}
        />
        <ViewChip
          href={buildHref({ view: "pending" })}
          label="Pending"
          sub="Started checkout, payment open"
          count={counts.pending}
          active={view === "pending"}
        />
        <ViewChip
          href={buildHref({ view: "failed" })}
          label="Failed"
          sub="Cancelled, failed, refunded, returned"
          count={counts.failed}
          active={view === "failed"}
          danger
        />
        <ViewChip
          href={buildHref({ view: "manual" })}
          label="Manual"
          sub="Created by an admin (any status)"
          count={counts.manual}
          active={view === "manual"}
        />
        <ViewChip
          href={buildHref({ view: "all" })}
          label="All"
          sub="Everything"
          count={counts.all}
          active={view === "all"}
        />
      </div>

      <div className="bg-white rounded-2xl border border-brand-line overflow-hidden">
        {rows.length === 0 ? (
          <div className="px-4 py-10 sm:px-5 sm:py-16 text-center">
            <Package size={32} className="text-brand-ink-soft mx-auto mb-2" />
            <p className="text-sm text-brand-ink-soft">
              {page > 1
                ? "You've reached the end — no more orders on this page."
                : q
                  ? `No orders match "${q}".`
                  : view === "live"
                    ? "No live orders. Paid orders will appear here as customers check out."
                    : view === "failed"
                      ? "No failed orders. Nothing to follow up on — clean slate."
                      : view === "pending"
                        ? "No pending orders. UPI carts in progress will appear here."
                        : "No orders yet."}
            </p>
            {page > 1 && (
              <Link
                href={buildPageHref({ view, q, page: page - 1 })}
                className="inline-block mt-3 text-xs font-semibold text-brand-red hover:underline"
              >
                ← Back to previous page
              </Link>
            )}
          </div>
        ) : (
          <ul className="divide-y divide-brand-line">
            {rows.map((o) => {
              const addr = o.shippingAddress as {
                fullName?: string;
                phone?: string;
                pincode?: string;
              };
              return (
                <li key={o.id}>
                  <Link
                    href={`/admin/orders/${o.id}`}
                    className="flex items-start gap-3 sm:gap-4 px-3 py-2.5 sm:px-5 sm:py-4 hover:bg-brand-cream transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                        <span className="font-mono font-semibold text-brand-ink text-[13px] sm:text-base">
                          {o.id}
                        </span>
                        <StatusBadge status={o.status} />
                        {/* Site chip is desktop-only — single combined store */}
                        <span className="hidden sm:inline text-[10px] font-mono uppercase tracking-widest text-brand-ink-soft border border-brand-line px-1.5 py-0.5 rounded">
                          {o.siteId}
                        </span>
                      </div>
                      <div className="text-[13px] sm:text-sm text-brand-ink mt-1 sm:mt-1.5 truncate">
                        {addr.fullName ?? "—"}
                        {addr.phone && (
                          <span className="text-brand-ink-soft font-mono ml-2">
                            {addr.phone}
                          </span>
                        )}
                        {/* Pincode is desktop-only — detail page has the full address */}
                        {addr.pincode && (
                          <span className="hidden sm:inline text-brand-ink-soft font-mono ml-2">
                            {addr.pincode}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] sm:text-xs text-brand-ink-soft mt-0.5 sm:mt-1">
                        {formatIST(o.placedAt)}
                        {" · "}
                        {o.paymentMethod}
                        {o.paymentStatus !== "PENDING" &&
                          ` · ${o.paymentStatus}`}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-semibold text-brand-ink tabular-nums text-sm sm:text-base">
                        {formatINR(o.totalInr)}
                      </div>
                      {/* AWB is desktop-only — it crowded the price column */}
                      {o.awbCode && (
                        <div className="hidden sm:block text-[10px] font-mono text-brand-ink-soft mt-0.5">
                          AWB {o.awbCode}
                        </div>
                      )}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Pagination — Prev/Next preserve the current view + search query. */}
      {(hasPrev || hasNext) && (
        <div className="flex items-center justify-between gap-3">
          {hasPrev ? (
            <Link
              href={buildPageHref({ view, q, page: page - 1 })}
              className="inline-flex items-center gap-1 bg-white border border-brand-line hover:border-brand-ink text-brand-ink text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
            >
              <ChevronLeft size={16} /> Previous
            </Link>
          ) : (
            <span />
          )}
          <span className="text-xs font-mono text-brand-ink-soft">
            Page {page}
          </span>
          {hasNext ? (
            <Link
              href={buildPageHref({ view, q, page: page + 1 })}
              className="inline-flex items-center gap-1 bg-white border border-brand-line hover:border-brand-ink text-brand-ink text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
            >
              Next <ChevronRight size={16} />
            </Link>
          ) : (
            <span />
          )}
        </div>
      )}
    </div>
  );
}

/** Build a list URL preserving view + search query for a given page. */
function buildPageHref(input: { view: View; q: string; page: number }): string {
  const parts: string[] = [];
  if (input.view !== "live") parts.push(`view=${input.view}`);
  if (input.q) parts.push(`q=${encodeURIComponent(input.q)}`);
  if (input.page > 1) parts.push(`page=${input.page}`);
  return `/admin/orders${parts.length ? "?" + parts.join("&") : ""}`;
}

function buildHref(input: { view: View }): string {
  const parts: string[] = [];
  if (input.view !== "live") parts.push(`view=${input.view}`);
  return `/admin/orders${parts.length ? "?" + parts.join("&") : ""}`;
}

function ViewChip({
  href,
  label,
  sub,
  count,
  active,
  danger,
}: {
  href: string;
  label: string;
  sub: string;
  count: number;
  active: boolean;
  danger?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`shrink-0 inline-flex flex-col items-start gap-0.5 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full sm:rounded-2xl transition-colors sm:min-w-[140px] ${
        active
          ? danger
            ? "bg-brand-red text-white"
            : "bg-brand-ink text-white"
          : "bg-white border border-brand-line text-brand-ink-soft hover:text-brand-ink"
      }`}
    >
      <div className="flex items-center gap-1.5 w-full">
        <span className="text-[13px] sm:text-sm font-semibold">{label}</span>
        <span
          className={`tabular-nums text-xs ${active ? "text-white/70" : "text-brand-ink-soft"}`}
        >
          {count}
        </span>
      </div>
      {/* Explainer sub-line is desktop-only — mobile chips are slim pills */}
      <span
        className={`hidden sm:block text-[10px] font-mono uppercase tracking-widest truncate ${
          active ? "text-white/60" : "text-brand-ink-soft"
        }`}
      >
        {sub}
      </span>
    </Link>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    PENDING: "bg-gold/10 text-gold",
    PENDING_COD_VERIFICATION: "bg-amber-100 text-amber-800",
    PAID: "bg-success/10 text-success",
    PACKED: "bg-success/10 text-success",
    SHIPPED: "bg-blue-100 text-blue-700",
    DELIVERED: "bg-success/15 text-success",
    CANCELLED: "bg-brand-red/10 text-brand-red",
    REFUNDED: "bg-brand-red/10 text-brand-red",
    FAILED: "bg-brand-red/10 text-brand-red",
    ABANDONED: "bg-brand-ink-soft/10 text-brand-ink-soft",
    RETURNED: "bg-brand-red/10 text-brand-red",
  };
  return (
    <span
      className={`${styles[status] ?? "bg-brand-line text-brand-ink"} text-[10px] font-mono uppercase tracking-widest font-semibold px-2 py-0.5 rounded-full`}
    >
      {status}
    </span>
  );
}
