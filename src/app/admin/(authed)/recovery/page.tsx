import { LifeBuoy } from "lucide-react";
import { requireAdmin } from "@/lib/admin-auth";
import { recoverCapturedPayments } from "@/lib/reconcile";
import { getRecoverableCarts, MIN_AGE_MIN } from "@/lib/recovery";
import { RecoveryList } from "@/components/RecoveryList";

export const dynamic = "force-dynamic";

export default async function RecoveryPage() {
  const ctx = await requireAdmin();

  // Money-truth before we list anyone: ask Razorpay whether any *recent* unpaid
  // order was in fact paid (webhook lag or a dropped capture) and flip it to
  // PAID — so a customer who just completed payment is never nudged. Scoped to
  // the last 30 min; older orders are kept current by the 5-min reconcile cron.
  // Best-effort: a Razorpay hiccup must never break the recovery view.
  await recoverCapturedPayments(50, 30 * 60 * 1000).catch(() => {});

  const nowMs = new Date().getTime();
  const data = await getRecoverableCarts(ctx.siteIds);

  return (
    <div className="space-y-3 sm:space-y-6">
      <div>
        <h1 className="font-display text-xl sm:text-3xl font-bold text-brand-ink flex items-center gap-2">
          <LifeBuoy size={24} className="text-brand-red" /> Cart recovery
        </h1>
        <p className="text-sm text-brand-ink-soft mt-1">
          Orders created but never paid — plus customers who filled their
          details at checkout but never reached payment (tagged{" "}
          <span className="text-brand-red font-semibold">Didn&apos;t reach payment</span>)
          — each with one-tap Call + WhatsApp. Hides carts under {MIN_AGE_MIN}{" "}
          min old (still checking out) and customers who already paid since.
        </p>
      </div>

      <RecoveryList data={data} nowMs={nowMs} />
    </div>
  );
}
