import Link from "next/link";
import { Package } from "lucide-react";
import { desc, inArray } from "drizzle-orm";
import { db } from "@/db";
import { orders } from "@/db/schema";
import { requireAdmin } from "@/lib/admin-auth";
import { formatINR } from "@/lib/utils";

export default async function AdminOrdersList({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; site?: string }>;
}) {
  const ctx = await requireAdmin();
  const params = await searchParams;

  const visibleSiteIds = params.site
    ? ctx.siteIds.filter((s) => s === params.site)
    : ctx.siteIds;

  const all = await db
    .select()
    .from(orders)
    .where(inArray(orders.siteId, visibleSiteIds))
    .orderBy(desc(orders.placedAt))
    .limit(100);

  const filtered = params.status
    ? all.filter((o) => o.status === params.status)
    : all;

  const statusCounts = all.reduce<Record<string, number>>((acc, o) => {
    acc[o.status] = (acc[o.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-brand-ink">
            Orders
          </h1>
          <p className="text-sm text-brand-ink-soft mt-1">
            Showing {filtered.length} of {all.length}
          </p>
        </div>
      </div>

      {/* Status filter chips */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
        <FilterChip
          href={`/admin/orders${params.site ? `?site=${params.site}` : ""}`}
          label="All"
          count={all.length}
          active={!params.status}
        />
        {(
          ["PENDING", "PAID", "PACKED", "SHIPPED", "DELIVERED"] as const
        ).map((s) => (
          <FilterChip
            key={s}
            href={`/admin/orders?status=${s}${params.site ? `&site=${params.site}` : ""}`}
            label={s}
            count={statusCounts[s] ?? 0}
            active={params.status === s}
          />
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-brand-line overflow-hidden">
        {filtered.length === 0 ? (
          <div className="px-5 py-16 text-center">
            <Package size={32} className="text-brand-ink-soft mx-auto mb-2" />
            <p className="text-sm text-brand-ink-soft">No orders match.</p>
          </div>
        ) : (
          <ul className="divide-y divide-brand-line">
            {filtered.map((o) => (
              <li key={o.id}>
                <Link
                  href={`/admin/orders/${o.id}`}
                  className="flex items-start gap-4 px-5 py-4 hover:bg-brand-cream transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-semibold text-brand-ink">
                        {o.id}
                      </span>
                      <StatusBadge status={o.status} />
                      <span className="text-[10px] font-mono uppercase tracking-widest text-brand-ink-soft border border-brand-line px-1.5 py-0.5 rounded">
                        {o.siteId}
                      </span>
                    </div>
                    <div className="text-xs text-brand-ink-soft mt-1.5">
                      {new Date(o.placedAt).toLocaleString("en-IN", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                      {" · "}
                      {o.paymentMethod}
                      {o.paymentStatus !== "PENDING" &&
                        ` · ${o.paymentStatus}`}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-semibold text-brand-ink tabular-nums">
                      {formatINR(o.totalInr)}
                    </div>
                    {o.awbCode && (
                      <div className="text-[10px] font-mono text-brand-ink-soft mt-0.5">
                        AWB {o.awbCode}
                      </div>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function FilterChip({
  href,
  label,
  count,
  active,
}: {
  href: string;
  label: string;
  count: number;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
        active
          ? "bg-brand-ink text-white"
          : "bg-white border border-brand-line text-brand-ink-soft hover:text-brand-ink"
      }`}
    >
      {label}
      <span
        className={`tabular-nums ${active ? "text-white/70" : "text-brand-ink-soft"}`}
      >
        {count}
      </span>
    </Link>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    PENDING: "bg-gold/10 text-gold",
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
