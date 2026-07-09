import Link from "next/link";
import { Plus } from "lucide-react";
import { desc, inArray, isNull, or } from "drizzle-orm";
import { db } from "@/db";
import { coupons } from "@/db/schema";
import { requireAdmin } from "@/lib/admin-auth";
import { formatINR } from "@/lib/utils";
import { CouponRowActions } from "./CouponRowActions";

export const dynamic = "force-dynamic";

type Tone = "ok" | "info" | "mute";

const TONE_CLASSES: Record<Tone, string> = {
  ok: "bg-success/10 text-success",
  info: "bg-blue-100 text-blue-700",
  mute: "bg-brand-ink-soft/10 text-brand-ink-soft",
};

const TYPE_LABELS: Record<string, string> = {
  FLAT_INR: "Flat ₹",
  PERCENT: "Percent",
  FREE_SHIPPING: "Free shipping",
};

function fmt(d: Date): string {
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    timeZone: "Asia/Kolkata",
  });
}

export default async function AdminDiscounts() {
  const ctx = await requireAdmin();

  const rows = await db
    .select()
    .from(coupons)
    .where(or(inArray(coupons.siteId, ctx.siteIds), isNull(coupons.siteId)))
    .orderBy(desc(coupons.createdAt))
    .limit(200);

  const now = new Date();

  const derived = rows.map((c) => {
    const validFrom = new Date(c.validFrom);
    const validTo = c.validTo ? new Date(c.validTo) : null;

    let status: { label: string; tone: Tone };
    if (!c.active) {
      status = { label: "Inactive", tone: "mute" };
    } else if (validFrom > now) {
      status = { label: "Scheduled", tone: "info" };
    } else if (validTo && validTo < now) {
      status = { label: "Expired", tone: "mute" };
    } else if (c.usageLimit != null && c.usedCount >= c.usageLimit) {
      status = { label: "Used up", tone: "mute" };
    } else {
      status = { label: "Active", tone: "ok" };
    }

    let valueLabel: string;
    if (c.type === "FLAT_INR") {
      valueLabel = formatINR(c.value);
    } else if (c.type === "PERCENT") {
      valueLabel = `${c.value / 100}%`;
    } else {
      valueLabel = "Free shipping";
    }

    const validityLabel = !validTo
      ? "Always"
      : `${fmt(validFrom)} – ${fmt(validTo)}`;

    const usedLabel = `${c.usedCount}${c.usageLimit != null ? ` / ${c.usageLimit}` : ""}`;

    return { coupon: c, status, valueLabel, validityLabel, usedLabel };
  });

  const totalCoupons = rows.length;
  const activeCount = derived.filter((d) => d.status.label === "Active").length;
  const totalRedemptions = rows.reduce((sum, c) => sum + c.usedCount, 0);

  const kpis = [
    { label: "Total coupons", value: totalCoupons.toLocaleString("en-IN") },
    { label: "Active", value: activeCount.toLocaleString("en-IN") },
    { label: "Total redemptions", value: totalRedemptions.toLocaleString("en-IN") },
  ];

  return (
    <div className="space-y-3 sm:space-y-6">
      <div className="flex items-start justify-between gap-3 sm:gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-lg sm:text-3xl font-bold text-brand-ink">
            Discounts
          </h1>
          <p className="text-sm text-brand-ink-soft mt-1">
            Coupon codes that apply at checkout. Create, edit, enable or retire
            them here.
          </p>
        </div>
        <Link
          href="/admin/discounts/new"
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-red px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 shrink-0"
        >
          <Plus size={16} /> Create discount
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        {kpis.map((kpi) => (
          <div
            key={kpi.label}
            className="bg-white rounded-2xl border border-brand-line p-3 sm:p-5"
          >
            <div className="text-[11px] font-mono font-bold uppercase tracking-widest text-brand-ink-soft">
              {kpi.label}
            </div>
            <div className="font-display text-xl sm:text-3xl font-bold text-brand-ink mt-2 tabular-nums">
              {kpi.value}
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-brand-line overflow-hidden">
        <div className="px-3 py-3 sm:px-5 sm:py-4 border-b border-brand-line">
          <h2 className="font-semibold text-brand-ink">All coupons</h2>
        </div>

        {derived.length === 0 ? (
          <div className="px-5 py-10 sm:py-16 text-center">
            <p className="text-sm font-semibold text-brand-ink">
              No discounts yet
            </p>
            <p className="text-sm text-brand-ink-soft mt-1">
              Create your first coupon to offer money off or free shipping at
              checkout.
            </p>
            <Link
              href="/admin/discounts/new"
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-brand-red px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90"
            >
              <Plus size={16} /> Create discount
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto no-scrollbar">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] font-mono uppercase tracking-wider text-brand-ink-soft border-b border-brand-line">
                  <th className="text-left px-3 sm:px-5 py-2 whitespace-nowrap">Code</th>
                  <th className="text-left px-3 sm:px-5 py-2 whitespace-nowrap">Type</th>
                  <th className="text-right px-3 sm:px-5 py-2 whitespace-nowrap">Value</th>
                  <th className="hidden sm:table-cell text-right px-5 py-2 whitespace-nowrap">Min order</th>
                  <th className="text-right px-3 sm:px-5 py-2 whitespace-nowrap">Used</th>
                  <th className="text-left px-3 sm:px-5 py-2 whitespace-nowrap">Validity</th>
                  <th className="text-left px-3 sm:px-5 py-2 whitespace-nowrap">Status</th>
                  <th className="text-right px-3 sm:px-5 py-2 whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-line">
                {derived.map((d) => (
                  <tr key={d.coupon.id}>
                    <td className="px-3 sm:px-5 py-2.5 sm:py-3 font-mono font-semibold whitespace-nowrap text-brand-ink">
                      {d.coupon.code}
                    </td>
                    <td className="px-3 sm:px-5 py-2.5 sm:py-3 whitespace-nowrap text-brand-ink-soft">
                      {TYPE_LABELS[d.coupon.type] ?? d.coupon.type}
                    </td>
                    <td className="px-3 sm:px-5 py-2.5 sm:py-3 text-right tabular-nums whitespace-nowrap text-brand-ink">
                      {d.valueLabel}
                    </td>
                    <td className="hidden sm:table-cell px-5 py-3 text-right tabular-nums whitespace-nowrap text-brand-ink-soft">
                      {d.coupon.minOrderInr > 0
                        ? formatINR(d.coupon.minOrderInr)
                        : "—"}
                    </td>
                    <td className="px-3 sm:px-5 py-2.5 sm:py-3 text-right tabular-nums whitespace-nowrap text-brand-ink-soft">
                      {d.usedLabel}
                    </td>
                    <td className="px-3 sm:px-5 py-2.5 sm:py-3 whitespace-nowrap text-brand-ink-soft">
                      {d.validityLabel}
                    </td>
                    <td className="px-3 sm:px-5 py-2.5 sm:py-3">
                      <span
                        className={`text-[10px] font-mono uppercase tracking-widest font-semibold px-2 py-0.5 rounded-full ${TONE_CLASSES[d.status.tone]}`}
                      >
                        {d.status.label}
                      </span>
                    </td>
                    <td className="px-3 sm:px-5 py-2.5 sm:py-3">
                      <CouponRowActions
                        id={d.coupon.id}
                        code={d.coupon.code}
                        active={d.coupon.active}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
