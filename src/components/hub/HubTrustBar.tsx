import { Star, PackageCheck, RotateCw, ShieldCheck } from "lucide-react";
import { TRUST } from "@/lib/config";

/**
 * Hub trust bar — a slim, high-contrast strip right under the hero. Four
 * genuine trust signals (rating, orders shipped, replacement, secure COD) so
 * the "is this a real shop?" doubt is answered before the buyer scrolls into
 * the catalog. Distinct from the (hidden) dark HubTrust badge row.
 */
const ITEMS = [
  {
    icon: Star,
    stat: `${TRUST.rating}/5`,
    label: `${TRUST.reviewCount.toLocaleString("en-IN")} ratings`,
  },
  {
    icon: PackageCheck,
    stat: `${TRUST.ordersShipped.toLocaleString("en-IN")}+`,
    label: "orders shipped",
  },
  {
    icon: RotateCw,
    stat: "7-Day",
    label: "free replacement",
  },
  {
    icon: ShieldCheck,
    stat: "Pan-India",
    label: "secure COD",
  },
] as const;

export default function HubTrustBar() {
  return (
    <section aria-label="Why buyers trust PRC" className="border-b border-brand-line bg-white">
      {/* One row of 4 on every width — mobile stacks icon above the stat so
          all four fit a 375px screen without wrapping. */}
      <div className="mx-auto grid max-w-6xl grid-cols-4 gap-1 px-2 py-3 sm:gap-0 sm:px-4 sm:py-4 sm:divide-x sm:divide-brand-line">
        {ITEMS.map(({ icon: Icon, stat, label }) => (
          <div
            key={label}
            className="flex flex-col items-center justify-center gap-1 text-center sm:flex-row sm:gap-2.5 sm:px-3 sm:text-left"
          >
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand-red/10 sm:h-9 sm:w-9">
              <Icon className="h-3 w-3 text-brand-red sm:h-[17px] sm:w-[17px]" />
            </span>
            <div className="leading-tight">
              <div className="text-[11px] font-extrabold text-brand-ink sm:text-sm">{stat}</div>
              <div className="text-[8px] text-brand-ink-soft sm:text-[11px]">{label}</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
