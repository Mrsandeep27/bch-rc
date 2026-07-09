import Link from "next/link";
import { ChevronLeft, ChevronRight, Search, Users } from "lucide-react";
import { ilike, inArray, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { customers, orders } from "@/db/schema";
import { requireAdmin } from "@/lib/admin-auth";
import { formatINR } from "@/lib/utils";
import { CustomersExport } from "./CustomersExport";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

export default async function AdminCustomers({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const ctx = await requireAdmin();
  const sp = await searchParams;

  const q = (sp.q ?? "").trim();
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  // Server-side search across the three identity columns. Nullable columns
  // (name/email) just don't match on NULL, which is the behaviour we want.
  const searchWhere = q
    ? or(
        ilike(customers.name, `%${q}%`),
        ilike(customers.phone, `%${q}%`),
        ilike(customers.email, `%${q}%`),
      )
    : undefined;

  // One page of customers, spend-ranked. Orders are joined only for the
  // admin's sites, so revenue/order counts reflect what this operator can see.
  const [list, [{ total }]] = await Promise.all([
    db
      .select({
        id: customers.id,
        phone: customers.phone,
        email: customers.email,
        name: customers.name,
        orderCount: sql<number>`count(${orders.id})::int`,
        revenue: sql<number>`coalesce(sum(${orders.totalInr}), 0)::int`,
      })
      .from(customers)
      .leftJoin(
        orders,
        sql`${orders.customerId} = ${customers.id} AND ${inArray(orders.siteId, ctx.siteIds)}`,
      )
      .where(searchWhere)
      .groupBy(customers.id)
      // Tiebreak on createdAt so page boundaries stay stable across requests.
      .orderBy(
        sql`coalesce(sum(${orders.totalInr}), 0) desc, ${customers.createdAt} desc`,
      )
      .limit(PAGE_SIZE)
      .offset(offset),
    db
      .select({ total: sql<number>`count(*)::int` })
      .from(customers)
      .where(searchWhere),
  ]);

  const start = total === 0 ? 0 : offset + 1;
  const end = offset + list.length;
  const hasPrev = page > 1;
  const hasNext = offset + list.length < total;

  const pageHref = (p: number) => {
    const parts: string[] = [];
    if (q) parts.push(`q=${encodeURIComponent(q)}`);
    if (p > 1) parts.push(`page=${p}`);
    return `/admin/customers${parts.length ? "?" + parts.join("&") : ""}`;
  };

  return (
    <div className="space-y-3 sm:space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-lg sm:text-3xl font-bold text-brand-ink">
            Customers
          </h1>
          <p className="text-sm text-brand-ink-soft mt-1">
            {q
              ? `${total} result${total === 1 ? "" : "s"} for "${q}"`
              : `${total} customers, ranked by lifetime spend across your sites.`}
          </p>
        </div>
        <CustomersExport />
      </div>

      {/* Search — GET form so the query lives in the URL (shareable, back-safe).
          Submitting resets to page 1 by omitting the page param. */}
      <form
        action="/admin/customers"
        method="GET"
        className="bg-white rounded-2xl border border-brand-line p-1.5 flex items-center gap-1.5"
      >
        <Search size={16} className="text-brand-ink-soft ml-2 shrink-0" />
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Search by name, phone, or email…"
          className="flex-1 px-2 py-2 text-sm text-brand-ink placeholder:text-brand-ink-soft focus:outline-none bg-transparent"
        />
        {q && (
          <Link
            href="/admin/customers"
            className="text-xs text-brand-ink-soft hover:text-brand-ink px-2"
          >
            Clear
          </Link>
        )}
        <button
          type="submit"
          className="bg-brand-ink text-white text-xs font-semibold uppercase tracking-widest px-3 py-2 rounded-xl"
        >
          Search
        </button>
      </form>

      <div className="bg-white rounded-2xl border border-brand-line overflow-x-auto no-scrollbar overflow-y-hidden">
        {list.length === 0 ? (
          <div className="px-5 py-10 sm:py-16 text-center">
            <Users size={32} className="text-brand-ink-soft mx-auto mb-2" />
            <p className="text-sm text-brand-ink-soft">
              {q ? `No customers match "${q}".` : "No customers yet."}
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-brand-cream text-xs font-mono uppercase tracking-widest text-brand-ink-soft">
              <tr>
                <th className="px-3 sm:px-5 py-2.5 sm:py-3 text-left">Customer</th>
                <th className="px-3 sm:px-5 py-2.5 sm:py-3 text-left">Phone</th>
                <th className="px-3 sm:px-5 py-2.5 sm:py-3 text-right">Orders</th>
                <th className="px-3 sm:px-5 py-2.5 sm:py-3 text-right">Spent</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-line">
              {list.map((c) => (
                <tr key={c.id} className="hover:bg-brand-cream transition-colors">
                  <td className="px-3 sm:px-5 py-2.5 sm:py-3">
                    <Link
                      href={`/admin/customers/${c.id}`}
                      className="block font-semibold whitespace-nowrap text-brand-ink hover:text-brand-red"
                    >
                      {c.name ?? "—"}
                    </Link>
                    {c.email && (
                      <div className="text-xs text-brand-ink-soft whitespace-nowrap">
                        {c.email}
                      </div>
                    )}
                  </td>
                  <td className="px-3 sm:px-5 py-2.5 sm:py-3 font-mono whitespace-nowrap text-brand-ink-soft">
                    {c.phone}
                  </td>
                  <td className="px-3 sm:px-5 py-2.5 sm:py-3 text-right tabular-nums">
                    {c.orderCount}
                  </td>
                  <td className="px-3 sm:px-5 py-2.5 sm:py-3 text-right font-semibold tabular-nums whitespace-nowrap">
                    {formatINR(c.revenue)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination — only render when there's more than one page. */}
      {(hasPrev || hasNext) && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-brand-ink-soft tabular-nums">
            Showing {start}–{end} of {total}
          </p>
          <div className="flex items-center gap-2">
            {hasPrev ? (
              <Link
                href={pageHref(page - 1)}
                className="inline-flex items-center gap-1 rounded-xl border border-brand-line bg-white px-3 py-2 text-sm font-semibold text-brand-ink hover:border-brand-ink transition-colors"
              >
                <ChevronLeft size={14} /> Prev
              </Link>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-xl border border-brand-line bg-white px-3 py-2 text-sm font-semibold text-brand-ink-soft opacity-50">
                <ChevronLeft size={14} /> Prev
              </span>
            )}
            {hasNext ? (
              <Link
                href={pageHref(page + 1)}
                className="inline-flex items-center gap-1 rounded-xl border border-brand-line bg-white px-3 py-2 text-sm font-semibold text-brand-ink hover:border-brand-ink transition-colors"
              >
                Next <ChevronRight size={14} />
              </Link>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-xl border border-brand-line bg-white px-3 py-2 text-sm font-semibold text-brand-ink-soft opacity-50">
                Next <ChevronRight size={14} />
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
