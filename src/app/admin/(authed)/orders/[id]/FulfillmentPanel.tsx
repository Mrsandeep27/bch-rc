"use client";

import { useState, useTransition } from "react";
import {
  Ban,
  Box,
  CheckCircle2,
  Loader2,
  Save,
  Tag,
  Truck,
} from "lucide-react";
import {
  cancelOrder,
  saveTracking,
  updateFulfillment,
  type ActionResult,
  type FulfillmentTarget,
} from "./actions";

type Props = {
  orderId: string;
  awbCode: string | null;
  courierName: string | null;
  trackingUrl: string | null;
  /** Forward-only next steps the server computed as valid from current status. */
  nextTargets: FulfillmentTarget[];
  canCancel: boolean;
};

const TARGET_META: Record<
  FulfillmentTarget,
  { label: string; icon: typeof Box }
> = {
  PACKED: { label: "Mark packed", icon: Box },
  SHIPPED: { label: "Mark shipped", icon: Truck },
  DELIVERED: { label: "Mark delivered", icon: CheckCircle2 },
};

type Msg = { kind: "ok" | "err"; text: string } | null;

export default function FulfillmentPanel({
  orderId,
  awbCode,
  courierName,
  trackingUrl,
  nextTargets,
  canCancel,
}: Props) {
  const [statusPending, startStatus] = useTransition();
  const [statusMsg, setStatusMsg] = useState<Msg>(null);

  const [awb, setAwb] = useState(awbCode ?? "");
  const [courier, setCourier] = useState(courierName ?? "");
  const [url, setUrl] = useState(trackingUrl ?? "");
  const [trackingPending, startTracking] = useTransition();
  const [trackingMsg, setTrackingMsg] = useState<Msg>(null);

  const [cancelPending, startCancel] = useTransition();
  const [cancelMsg, setCancelMsg] = useState<Msg>(null);

  const trackingDirty =
    awb !== (awbCode ?? "") ||
    courier !== (courierName ?? "") ||
    url !== (trackingUrl ?? "");

  function apply(setter: (m: Msg) => void, res: ActionResult, ok: string) {
    setter(
      res.ok
        ? { kind: "ok", text: res.message ?? ok }
        : { kind: "err", text: res.error },
    );
  }

  function handleAdvance(target: FulfillmentTarget) {
    setStatusMsg(null);
    startStatus(async () => {
      const res = await updateFulfillment(orderId, target);
      apply(setStatusMsg, res, "Updated.");
    });
  }

  function handleSaveTracking() {
    setTrackingMsg(null);
    startTracking(async () => {
      const res = await saveTracking(orderId, awb, courier, url);
      apply(setTrackingMsg, res, "Saved.");
    });
  }

  function handleCancel() {
    if (
      !window.confirm(
        "Cancel this order? Reserved stock + coupon usage will be released. This does NOT refund money — use Refund for that.",
      )
    )
      return;
    setCancelMsg(null);
    startCancel(async () => {
      const res = await cancelOrder(orderId);
      apply(setCancelMsg, res, "Cancelled.");
    });
  }

  return (
    <div className="bg-white rounded-2xl border border-brand-line p-3 sm:p-5 space-y-4 sm:space-y-5">
      <h2 className="font-semibold text-brand-ink">Manage fulfilment</h2>

      {/* Advance status */}
      {nextTargets.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-mono uppercase tracking-widest text-brand-ink-soft">
            Advance status
          </p>
          <div className="flex flex-wrap gap-2">
            {nextTargets.map((t) => {
              const Icon = TARGET_META[t].icon;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => handleAdvance(t)}
                  disabled={statusPending}
                  className="inline-flex items-center gap-1.5 bg-brand-ink hover:bg-brand-ink-soft text-white text-xs font-semibold px-3 py-2.5 sm:py-2 rounded-xl transition-colors disabled:opacity-50"
                >
                  {statusPending ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Icon size={14} />
                  )}
                  {TARGET_META[t].label}
                </button>
              );
            })}
          </div>
          {statusMsg && (
            <p
              className={`text-xs ${statusMsg.kind === "ok" ? "text-success" : "text-brand-red"}`}
            >
              {statusMsg.text}
            </p>
          )}
        </div>
      )}

      {/* Tracking editor */}
      <div className="space-y-2.5 pt-1 border-t border-brand-line">
        <p className="text-xs font-mono uppercase tracking-widest text-brand-ink-soft pt-3 inline-flex items-center gap-1.5">
          <Tag size={12} /> Tracking / AWB
        </p>
        <div className="space-y-2">
          <input
            value={awb}
            onChange={(e) => setAwb(e.target.value.slice(0, 60))}
            placeholder="AWB / tracking number"
            className="w-full rounded-xl border border-brand-line bg-brand-cream/40 px-3 py-2 text-sm text-brand-ink placeholder:text-brand-ink-soft focus:outline-none focus:border-brand-red transition-colors"
          />
          <input
            value={courier}
            onChange={(e) => setCourier(e.target.value.slice(0, 80))}
            placeholder="Courier name (e.g. Delhivery)"
            className="w-full rounded-xl border border-brand-line bg-brand-cream/40 px-3 py-2 text-sm text-brand-ink placeholder:text-brand-ink-soft focus:outline-none focus:border-brand-red transition-colors"
          />
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value.slice(0, 500))}
            placeholder="Tracking URL (https://…)"
            className="w-full rounded-xl border border-brand-line bg-brand-cream/40 px-3 py-2 text-sm text-brand-ink placeholder:text-brand-ink-soft focus:outline-none focus:border-brand-red transition-colors"
          />
        </div>
        <div className="flex items-center justify-end">
          <button
            type="button"
            onClick={handleSaveTracking}
            disabled={!trackingDirty || trackingPending}
            className="inline-flex items-center gap-1.5 bg-brand-ink text-white text-xs font-semibold uppercase tracking-widest px-3 py-2.5 sm:py-2 rounded-xl disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {trackingPending ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Save size={14} />
            )}
            Save tracking
          </button>
        </div>
        {trackingMsg && (
          <p
            className={`text-xs ${trackingMsg.kind === "ok" ? "text-success" : "text-brand-red"}`}
          >
            {trackingMsg.text}
          </p>
        )}
      </div>

      {/* Cancel (danger) */}
      {canCancel && (
        <div className="space-y-2 pt-4 border-t border-brand-line">
          <p className="text-xs text-brand-ink-soft">
            Cancelling releases reserved stock + coupon usage. Money is not
            refunded automatically.
          </p>
          <button
            type="button"
            onClick={handleCancel}
            disabled={cancelPending}
            className="w-full inline-flex items-center justify-center gap-2 border border-brand-red text-brand-red hover:bg-brand-red hover:text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors disabled:opacity-50"
          >
            {cancelPending ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Ban size={14} />
            )}
            Cancel order
          </button>
          {cancelMsg && (
            <p
              className={`text-xs ${cancelMsg.kind === "ok" ? "text-success" : "text-brand-red"}`}
            >
              {cancelMsg.text}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
