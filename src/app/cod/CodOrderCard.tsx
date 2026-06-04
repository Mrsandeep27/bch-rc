"use client";

import { useState, useTransition } from "react";
import {
  Phone,
  MapPin,
  Clock,
  Check,
  X,
  AlertCircle,
  Truck,
  ShieldOff,
} from "lucide-react";
import { confirmCodOrder, rejectCodOrder } from "./actions";

type Order = {
  id: string;
  totalInr: number;
  subtotalInr: number;
  shippingInr: number;
  codFeeInr: number;
  discountInr: number;
  couponCode: string | null;
  placedAt: Date;
  paidAt: Date | null;
  cancelledAt: Date | null;
  awbCode: string | null;
  courierName: string | null;
  trackingUrl: string | null;
  shippingAddress: unknown;
  items: unknown;
};

type Address = {
  fullName: string;
  phone: string;
  email?: string | null;
  line1: string;
  line2?: string | null;
  city: string;
  state: string;
  pincode: string;
};

type Item = {
  name: string;
  qty: number;
  lineTotalInr: number;
  image?: string | null;
};

type Mode = "pending" | "approved" | "rejected";

function relativeTime(d: Date | string | null): string {
  if (!d) return "—";
  const ms = Date.now() - new Date(d).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  return `${days}d ago`;
}

function inr(n: number): string {
  return `₹${n.toLocaleString("en-IN")}`;
}

export function CodOrderCard({
  order,
  mode = "pending",
  rejectKind = null,
}: {
  order: Order;
  mode?: Mode;
  rejectKind?: "operator" | "auto" | null;
}) {
  const addr = order.shippingAddress as Address;
  const items = (order.items as Item[]) ?? [];
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<"confirmed" | "rejected" | null>(null);

  function onConfirm() {
    if (!confirm(`Confirm ${order.id}? Shipment will be created and customer emailed.`)) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await confirmCodOrder(order.id);
      if (res.ok) {
        setDone("confirmed");
      } else {
        setError(res.error);
      }
    });
  }

  function onReject() {
    if (!confirm(`Reject ${order.id}? Inventory will be released. Customer will NOT be notified.`)) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await rejectCodOrder(order.id);
      if (res.ok) {
        setDone("rejected");
      } else {
        setError(res.error);
      }
    });
  }

  // Inline post-action confirmation. The page revalidates on the next nav,
  // but this gives an immediate visual ack so the operator doesn't
  // double-click while waiting for the re-render.
  if (done) {
    return (
      <div
        className={`rounded-2xl p-5 border-2 ${
          done === "confirmed"
            ? "bg-green-50 border-green-200"
            : "bg-gray-50 border-gray-200"
        }`}
      >
        <div className="flex items-center gap-2 font-semibold">
          {done === "confirmed" ? (
            <Check size={18} className="text-green-700" />
          ) : (
            <X size={18} className="text-gray-700" />
          )}
          <span>
            {order.id} — {done === "confirmed" ? "confirmed" : "rejected"}
          </span>
        </div>
      </div>
    );
  }

  const isApproved = mode === "approved";
  const isRejected = mode === "rejected";
  const readonly = isApproved || isRejected;

  const borderClass = isApproved
    ? "border-green-200"
    : isRejected
      ? "border-red-100"
      : "border-brand-line";

  return (
    <div className={`bg-white rounded-2xl p-5 shadow-sm border ${borderClass}`}>
      {/* Outcome banner for non-pending modes */}
      {isApproved && (
        <div className="flex items-center gap-2 text-sm text-green-800 bg-green-50 rounded-lg px-3 py-2 mb-3">
          <Check size={14} />
          <span>
            Confirmed {relativeTime(order.paidAt)}
            {order.awbCode ? ` · shipped via ${order.courierName ?? "courier"}` : ""}
          </span>
        </div>
      )}
      {isRejected && (
        <div className="flex items-center gap-2 text-sm text-red-800 bg-red-50 rounded-lg px-3 py-2 mb-3">
          {rejectKind === "auto" ? <ShieldOff size={14} /> : <X size={14} />}
          <span>
            Rejected {relativeTime(order.cancelledAt)}
            {rejectKind === "auto"
              ? " · auto-expired after 48h"
              : rejectKind === "operator"
                ? " · by operator"
                : ""}
          </span>
        </div>
      )}

      <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
        <div>
          <div className="font-mono font-bold text-base">{order.id}</div>
          <div className="text-xs text-brand-ink-soft flex items-center gap-1 mt-0.5">
            <Clock size={12} /> placed {relativeTime(order.placedAt)}
          </div>
        </div>
        <div className="text-right">
          <div className="font-bold text-lg">{inr(order.totalInr)}</div>
          <div className="text-xs text-brand-ink-soft">COD</div>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4 mb-4">
        <div>
          <div className="text-xs font-mono uppercase tracking-widest text-brand-ink-soft mb-1">
            Customer
          </div>
          <div className="font-semibold">{addr.fullName}</div>
          <a
            href={`tel:+91${addr.phone}`}
            className="inline-flex items-center gap-1.5 text-brand-red font-bold text-base mt-0.5 hover:underline"
          >
            <Phone size={14} />
            +91 {addr.phone}
          </a>
          {addr.email && (
            <div className="text-xs text-brand-ink-soft mt-0.5">{addr.email}</div>
          )}
        </div>
        <div>
          <div className="text-xs font-mono uppercase tracking-widest text-brand-ink-soft mb-1">
            Ship to
          </div>
          <div className="text-sm flex items-start gap-1.5">
            <MapPin size={14} className="mt-0.5 shrink-0 text-brand-ink-soft" />
            <span>
              {addr.line1}
              {addr.line2 ? `, ${addr.line2}` : ""}
              <br />
              {addr.city}, {addr.state} {addr.pincode}
            </span>
          </div>
        </div>
      </div>

      <div className="border-t border-brand-line pt-3 mb-4">
        <div className="text-xs font-mono uppercase tracking-widest text-brand-ink-soft mb-2">
          Items ({items.length})
        </div>
        <div className="space-y-1.5">
          {items.map((i, idx) => (
            <div key={idx} className="flex items-center gap-3 text-sm">
              {i.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={i.image}
                  alt={i.name}
                  width={40}
                  height={40}
                  className="w-10 h-10 rounded-lg object-cover border border-brand-line"
                />
              ) : (
                <div className="w-10 h-10 rounded-lg bg-brand-cream border border-brand-line" />
              )}
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{i.name}</div>
                <div className="text-xs text-brand-ink-soft">
                  Qty {i.qty} · {inr(i.lineTotalInr)}
                </div>
              </div>
            </div>
          ))}
        </div>
        {(order.couponCode || order.shippingInr > 0 || order.codFeeInr > 0) && (
          <div className="text-xs text-brand-ink-soft mt-2 space-x-3">
            {order.shippingInr > 0 && <span>Shipping {inr(order.shippingInr)}</span>}
            {order.codFeeInr > 0 && <span>COD fee {inr(order.codFeeInr)}</span>}
            {order.discountInr > 0 && (
              <span className="text-green-700">
                Discount −{inr(order.discountInr)}
                {order.couponCode ? ` (${order.couponCode})` : ""}
              </span>
            )}
          </div>
        )}
      </div>

      {isApproved && order.trackingUrl && (
        <a
          href={order.trackingUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm text-brand-ink font-semibold border border-brand-line hover:bg-brand-cream px-3 py-2 rounded-lg"
        >
          <Truck size={14} />
          Track shipment {order.awbCode ? `· ${order.awbCode}` : ""}
        </a>
      )}

      {error && (
        <div className="mb-3 flex items-center gap-1.5 text-sm text-brand-red font-medium">
          <AlertCircle size={14} />
          {error}
        </div>
      )}

      {!readonly && (
        <div className="flex gap-2">
          <button
            onClick={onConfirm}
            disabled={pending}
            className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-lg disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
          >
            <Check size={16} />
            Confirm
          </button>
          <button
            onClick={onReject}
            disabled={pending}
            className="flex-1 bg-white hover:bg-red-50 border-2 border-red-300 text-red-700 font-bold py-3 rounded-lg disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
          >
            <X size={16} />
            Reject
          </button>
        </div>
      )}
    </div>
  );
}
