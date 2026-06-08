"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import {
  Printer,
  FileText,
  Check,
  Loader2,
  MapPin,
  AlertCircle,
} from "lucide-react";
import {
  printLabelAction,
  printInvoiceAction,
  markDispatchedAction,
} from "./actions";

type Props = {
  orderId: string;
  status: string;
  awbCode: string | null;
  courierName: string | null;
  shippingAddress: {
    fullName: string;
    phone: string;
    city: string;
    state: string;
    pincode: string;
  };
  items: Array<{ name: string; qty: number; image?: string | null }>;
  paymentMethod: string;
  totalInr: number;
  packedAt: Date | string | null;
  shippedAt: Date | string | null;
  showActions: boolean;
};

function formatTime(d: Date | string | null): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "short",
  });
}

export function PackOrderRow({
  orderId,
  status,
  awbCode,
  courierName,
  shippingAddress,
  items,
  paymentMethod,
  totalInr,
  packedAt,
  shippedAt,
  showActions,
}: Props) {
  const [busy, startTransition] = useTransition();
  const [busyKind, setBusyKind] = useState<"label" | "invoice" | "dispatch" | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handlePrintLabel() {
    setError(null);
    setBusyKind("label");
    startTransition(async () => {
      const result = await printLabelAction(orderId);
      setBusyKind(null);
      if (result.ok) {
        window.open(result.labelUrl, "_blank", "noopener");
      } else {
        setError(result.error);
      }
    });
  }

  function handlePrintInvoice() {
    setError(null);
    setBusyKind("invoice");
    startTransition(async () => {
      const result = await printInvoiceAction(orderId);
      setBusyKind(null);
      if (result.ok) {
        window.open(result.invoiceUrl, "_blank", "noopener");
      } else {
        setError(result.error);
      }
    });
  }

  function handleMarkDispatched() {
    setError(null);
    setBusyKind("dispatch");
    startTransition(async () => {
      const result = await markDispatchedAction(orderId);
      setBusyKind(null);
      if (!result.ok) setError(result.error);
      // On success, revalidatePath in the action will refresh the list
      // and this row will move to the "Dispatched" tab automatically.
    });
  }

  const isCod = paymentMethod === "COD";
  const itemCount = items.reduce((s, i) => s + i.qty, 0);

  return (
    <div className="bg-white rounded-xl text-brand-ink p-3 sm:p-4">
      {/* Top row — order id + status + amount */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-sm font-bold">{orderId}</span>
            <StatusBadge status={status} />
            {isCod && (
              <span className="text-[10px] font-mono uppercase tracking-widest font-bold bg-warning/15 text-warning px-1.5 py-0.5 rounded">
                COD
              </span>
            )}
          </div>
          <p className="text-xs text-brand-ink-soft mt-0.5 font-mono">
            {status === "SHIPPED" ? "Dispatched " : "Packed "}
            {formatTime(status === "SHIPPED" ? shippedAt : packedAt)}
          </p>
        </div>
        <div className="text-right shrink-0">
          <div className="font-bold tabular-nums">₹{totalInr.toLocaleString("en-IN")}</div>
          <div className="text-[10px] font-mono uppercase tracking-widest text-brand-ink-soft">
            {itemCount} item{itemCount === 1 ? "" : "s"}
          </div>
        </div>
      </div>

      {/* Customer + items */}
      <div className="mt-3 grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3">
        <div className="space-y-2">
          {items.map((it, idx) => (
            <div key={idx} className="flex items-center gap-2.5">
              {it.image ? (
                <div className="relative w-9 h-9 rounded bg-brand-cream overflow-hidden shrink-0">
                  <Image
                    src={it.image}
                    alt={it.name}
                    fill
                    sizes="36px"
                    className="object-contain p-0.5"
                  />
                </div>
              ) : (
                <div className="w-9 h-9 rounded bg-brand-cream shrink-0" />
              )}
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium leading-tight truncate">
                  {it.name}
                </div>
                <div className="text-[11px] text-brand-ink-soft">
                  Qty {it.qty}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Address column */}
        <div className="text-xs text-brand-ink-soft sm:text-right sm:max-w-[200px]">
          <div className="font-semibold text-brand-ink">
            {shippingAddress.fullName}
          </div>
          <div className="font-mono mt-0.5">{shippingAddress.phone}</div>
          <div className="flex items-center gap-1 mt-1 sm:justify-end">
            <MapPin size={11} className="shrink-0" />
            <span>
              {shippingAddress.city} · {shippingAddress.pincode}
            </span>
          </div>
        </div>
      </div>

      {/* AWB strip */}
      {awbCode && (
        <div className="mt-3 bg-brand-cream rounded-lg px-3 py-2 flex items-center justify-between gap-2 flex-wrap">
          <div className="font-mono text-xs">
            <span className="text-brand-ink-soft uppercase tracking-widest mr-1.5">
              AWB
            </span>
            <span className="font-semibold">{awbCode}</span>
          </div>
          {courierName && (
            <span className="text-[10px] font-mono uppercase tracking-widest text-brand-ink-soft">
              via {courierName}
            </span>
          )}
        </div>
      )}

      {/* Actions */}
      {showActions && awbCode && (
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            onClick={handlePrintLabel}
            disabled={busy}
            className="inline-flex items-center gap-1.5 bg-brand-ink hover:bg-brand-ink-soft text-white text-xs font-semibold px-3 py-2 rounded-lg disabled:opacity-50 transition-colors"
          >
            {busyKind === "label" ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <Printer size={13} />
            )}
            Print label
          </button>
          <button
            onClick={handlePrintInvoice}
            disabled={busy}
            className="inline-flex items-center gap-1.5 bg-white border border-brand-line hover:border-brand-ink text-brand-ink text-xs font-semibold px-3 py-2 rounded-lg disabled:opacity-50 transition-colors"
          >
            {busyKind === "invoice" ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <FileText size={13} />
            )}
            Invoice
          </button>
          <button
            onClick={handleMarkDispatched}
            disabled={busy}
            className="inline-flex items-center gap-1.5 bg-success hover:bg-success/90 text-white text-xs font-semibold px-3 py-2 rounded-lg disabled:opacity-50 transition-colors ml-auto"
          >
            {busyKind === "dispatch" ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <Check size={13} />
            )}
            Mark dispatched
          </button>
        </div>
      )}

      {/* Empty AWB state for the AWB-pending tab */}
      {showActions === false && !awbCode && (
        <div className="mt-3 text-xs text-brand-ink-soft inline-flex items-center gap-1.5">
          <Loader2 size={12} className="animate-spin" />
          Shiprocket assigning AWB… usually ~30 sec.
        </div>
      )}

      {error && (
        <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-brand-red font-medium">
          <AlertCircle size={12} />
          {error}
        </p>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; fg: string; label: string }> = {
    PAID: { bg: "bg-blue-100", fg: "text-blue-800", label: "PAID" },
    PACKED: { bg: "bg-amber-100", fg: "text-amber-800", label: "PACKED" },
    SHIPPED: { bg: "bg-success/15", fg: "text-success", label: "SHIPPED" },
  };
  const s = map[status] ?? {
    bg: "bg-brand-line/40",
    fg: "text-brand-ink-soft",
    label: status,
  };
  return (
    <span
      className={`text-[10px] font-mono font-bold uppercase tracking-widest px-1.5 py-0.5 rounded ${s.bg} ${s.fg}`}
    >
      {s.label}
    </span>
  );
}
