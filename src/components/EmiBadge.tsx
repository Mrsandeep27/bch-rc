import { EMI, emiMonthlyInr } from "@/lib/config";
import { formatINR, cn } from "@/lib/utils";

/**
 * "No-Cost EMI from ₹X/mo" hook. Renders nothing below the EMI floor
 * (EMI.minInr) so it only appears where the Razorpay EMI rail can actually
 * fulfill it (1:16, HobbyGrade, 2+ bundles). `priceInr` is the CHARGED amount
 * the monthly is computed against — pass the online/prepaid price, since EMI is
 * a card (prepaid) method.
 *
 * variants:
 *   - "card" → compact one-liner for the product grid
 *   - "pdp"  → pill for the PDP price block
 */
export function EmiBadge({
  priceInr,
  variant = "card",
  className,
}: {
  priceInr: number;
  variant?: "card" | "pdp";
  className?: string;
}) {
  const monthly = emiMonthlyInr(priceInr);
  if (monthly <= 0) return null;

  if (variant === "card") {
    return (
      <div className={cn("font-mono text-[10px] text-brand-ink-soft", className)}>
        or No-Cost EMI from{" "}
        <span className="font-semibold text-brand-ink">{formatINR(monthly)}/mo</span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-brand-red/40 bg-brand-red-soft px-3.5 py-1.5 text-xs sm:text-sm font-semibold text-brand-ink shadow-sm",
        className,
      )}
    >
      {/* "Live" pulsing dot — reads as an active, time-sensitive offer. */}
      <span className="relative flex h-2 w-2" aria-hidden>
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-red opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-brand-red" />
      </span>
      <span className="font-bold text-brand-red">No-Cost EMI</span>
      <span className="text-brand-ink-soft">from</span>
      <span className="font-bold">{formatINR(monthly)}/mo</span>
      <span className="text-brand-ink-soft">× {EMI.tenureMonths}</span>
    </div>
  );
}
