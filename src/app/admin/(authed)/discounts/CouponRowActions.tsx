"use client";

/**
 * Per-row controls for a coupon: Edit (link), Enable/Disable, Delete. Enable and
 * Delete call the real server actions, which revalidate the list so the row
 * updates in place. Delete is confirm()-guarded and the server additionally
 * refuses to delete a redeemed coupon.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Pencil, Power, Trash2 } from "lucide-react";
import { deleteCoupon, toggleCoupon } from "./actions";

export function CouponRowActions({
  id,
  code,
  active,
}: {
  id: string;
  code: string;
  active: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onToggle() {
    setError(null);
    startTransition(async () => {
      const res = await toggleCoupon(id, !active);
      if (!res.ok) setError(res.error ?? "Failed");
      else router.refresh();
    });
  }

  function onDelete() {
    setError(null);
    if (!window.confirm(`Delete coupon ${code}? This can't be undone.`)) return;
    startTransition(async () => {
      const res = await deleteCoupon(id);
      if (!res.ok) setError(res.error ?? "Failed");
      else router.refresh();
    });
  }

  const btn =
    "inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-2.5 sm:py-1.5 rounded-lg border transition-colors disabled:opacity-50";

  return (
    <div className="flex items-center justify-end gap-1.5 flex-wrap">
      <Link
        href={`/admin/discounts/${id}`}
        className={`${btn} border-brand-line text-brand-ink-soft hover:text-brand-ink hover:border-brand-ink/30`}
      >
        <Pencil size={13} /> Edit
      </Link>
      <button
        type="button"
        onClick={onToggle}
        disabled={pending}
        className={`${btn} ${
          active
            ? "border-brand-line text-brand-ink-soft hover:bg-brand-cream"
            : "border-success/40 text-success hover:bg-success/10"
        }`}
      >
        <Power size={13} /> {active ? "Disable" : "Enable"}
      </button>
      <button
        type="button"
        onClick={onDelete}
        disabled={pending}
        className={`${btn} border-brand-red/40 text-brand-red hover:bg-brand-red/10`}
      >
        <Trash2 size={13} /> Delete
      </button>
      {error && (
        <span className="w-full text-right text-xs text-brand-red">{error}</span>
      )}
    </div>
  );
}
