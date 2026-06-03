"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Truck, AlertCircle, CheckCircle2 } from "lucide-react";

type Props = {
  orderId: string;
  hasShipment: boolean;
};

export function ShipButton({ orderId, hasShipment }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<
    { ok: true; awb?: string | null } | { ok: false; error: string } | null
  >(null);

  async function handleClick() {
    if (loading) return; // synchronous guard — `disabled` lags a render
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch(`/api/orders/${orderId}/ship`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        setResult({ ok: false, error: data.error ?? "Failed" });
        return;
      }
      setResult({ ok: true, awb: data.awbCode });
      router.refresh();
    } catch (err) {
      setResult({ ok: false, error: String(err) });
    } finally {
      setLoading(false);
    }
  }

  if (result?.ok) {
    return (
      <div className="inline-flex items-center gap-1.5 text-sm text-success font-semibold">
        <CheckCircle2 size={14} />
        {result.awb ? `AWB ${result.awb}` : "Shipment created"}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="inline-flex items-center gap-1.5 bg-brand-ink hover:bg-brand-ink-soft text-white text-sm font-semibold px-3 py-2 rounded-lg transition-colors disabled:opacity-50"
      >
        <Truck size={14} />
        {loading
          ? "Creating shipment..."
          : hasShipment
            ? "Retry shipment"
            : "Create shipment"}
      </button>
      {result?.ok === false && (
        <p className="inline-flex items-center gap-1 text-xs text-brand-red">
          <AlertCircle size={12} />
          {result.error}
        </p>
      )}
    </div>
  );
}
