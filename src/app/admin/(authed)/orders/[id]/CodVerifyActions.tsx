"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Loader2, PhoneCall, XCircle } from "lucide-react";
import { adminConfirmCod, adminRejectCod, type ActionResult } from "./actions";

/**
 * In-module COD verification for a PENDING_COD_VERIFICATION order. Reuses the
 * shared /cod confirm/reject core via the admin server actions — same money +
 * shipment + notification path the /cod console runs, no COD cookie needed.
 * Rendered only when the order is actually awaiting COD verification.
 */
export default function CodVerifyActions({ orderId }: { orderId: string }) {
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(
    null,
  );

  function run(fn: () => Promise<ActionResult>, okFallback: string) {
    setMsg(null);
    startTransition(async () => {
      const res = await fn();
      setMsg(
        res.ok
          ? { kind: "ok", text: res.message ?? okFallback }
          : { kind: "err", text: res.error },
      );
    });
  }

  function handleConfirm() {
    if (
      !window.confirm(
        "Confirm this COD order? This marks it PAID, creates the shipment, and emails/WhatsApps the customer.",
      )
    )
      return;
    run(() => adminConfirmCod(orderId), "COD confirmed.");
  }

  function handleReject() {
    if (
      !window.confirm(
        "Reject this COD order? It will be cancelled and inventory released. The customer is NOT notified.",
      )
    )
      return;
    const reason = window.prompt("Reason (optional):") ?? undefined;
    run(() => adminRejectCod(orderId, reason || undefined), "COD rejected.");
  }

  return (
    <div className="bg-white rounded-2xl border border-amber-300 bg-amber-50/40 p-3 sm:p-5 space-y-3">
      <h2 className="font-semibold text-brand-ink inline-flex items-center gap-2">
        <PhoneCall size={16} className="text-amber-600" />
        COD verification
      </h2>
      <p className="text-xs text-brand-ink-soft">
        Call the customer to confirm the order is genuine, then confirm or reject
        below.
      </p>
      <div className="flex flex-col sm:flex-row gap-2">
        <button
          type="button"
          onClick={handleConfirm}
          disabled={pending}
          className="flex-1 inline-flex items-center justify-center gap-2 bg-success hover:opacity-90 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-opacity disabled:opacity-50"
        >
          {pending ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <CheckCircle2 size={14} />
          )}
          Confirm order
        </button>
        <button
          type="button"
          onClick={handleReject}
          disabled={pending}
          className="flex-1 inline-flex items-center justify-center gap-2 border border-brand-red text-brand-red hover:bg-brand-red hover:text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors disabled:opacity-50"
        >
          {pending ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <XCircle size={14} />
          )}
          Reject
        </button>
      </div>
      {msg && (
        <p
          className={`text-xs ${msg.kind === "ok" ? "text-success" : "text-brand-red"}`}
        >
          {msg.text}
        </p>
      )}
    </div>
  );
}
