"use client";

/**
 * One-tap restock from the dashboard's Low-stock widget. Hits the SAME audited
 * endpoint the product editor uses (POST /api/admin/inventory, mode "adjust"),
 * which upserts the row and writes an `events` audit entry, then refreshes the
 * server component so the number updates in place.
 *
 * Deliberately a relative "+N" adjust, not an absolute set: two operators
 * restocking at once must not clobber each other's count.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Plus } from "lucide-react";

export function QuickRestock({
  skuId,
  variantSlug,
  step = 10,
}: {
  skuId: string;
  variantSlug: string;
  step?: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function restock() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/inventory", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ skuId, variantSlug, mode: "adjust", value: step }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Restock failed");
      setDone(true);
      router.refresh();
      setTimeout(() => setDone(false), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Restock failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end">
      <button
        type="button"
        onClick={restock}
        disabled={busy}
        title={`Add ${step} units to ${skuId}${variantSlug ? ` · ${variantSlug}` : ""}`}
        className="inline-flex items-center gap-1 rounded-lg border border-brand-line bg-white px-2 py-1 text-[11px] font-semibold text-brand-ink hover:border-brand-ink disabled:opacity-50 transition-colors"
      >
        {busy ? (
          <Loader2 size={11} className="animate-spin" />
        ) : done ? (
          <Check size={11} className="text-success" />
        ) : (
          <Plus size={11} />
        )}
        {done ? "Added" : `${step}`}
      </button>
      {error && <span className="mt-0.5 text-[10px] text-brand-red">{error}</span>}
    </div>
  );
}
