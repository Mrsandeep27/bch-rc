"use client";

import { useState, useTransition } from "react";
import { Loader2, RotateCcw, Save, StickyNote } from "lucide-react";
import { refundOrderFully, saveOrderNote, type ActionResult } from "./actions";

type Props = {
  orderId: string;
  initialNotes: string | null;
  /** Whether the Refund button should be rendered at all (set from the
   *  server based on payment + status state — keeps the client component
   *  simple and avoids leaking the rule into the client bundle). */
  canRefund: boolean;
  refundAmountLabel: string;
};

export default function OrderActions({
  orderId,
  initialNotes,
  canRefund,
  refundAmountLabel,
}: Props) {
  const [notes, setNotes] = useState(initialNotes ?? "");
  const [savedNotes, setSavedNotes] = useState(initialNotes ?? "");
  const [notesPending, startNotesTransition] = useTransition();
  const [notesMsg, setNotesMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const [refundPending, startRefundTransition] = useTransition();
  const [refundMsg, setRefundMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const noteDirty = notes !== savedNotes;

  function show(
    setter: typeof setNotesMsg,
    res: ActionResult,
    okFallback: string,
  ) {
    if (res.ok) {
      setter({ kind: "ok", text: res.message ?? okFallback });
    } else {
      setter({ kind: "err", text: res.error });
    }
  }

  function handleSaveNotes() {
    setNotesMsg(null);
    startNotesTransition(async () => {
      const res = await saveOrderNote(orderId, notes);
      show(setNotesMsg, res, "Saved.");
      if (res.ok) setSavedNotes(notes);
    });
  }

  function handleRefund() {
    if (
      !window.confirm(
        `Refund ${refundAmountLabel} to the customer? Razorpay can't undo this.`,
      )
    )
      return;
    setRefundMsg(null);
    startRefundTransition(async () => {
      const res = await refundOrderFully(orderId);
      show(setRefundMsg, res, "Refund initiated.");
    });
  }

  return (
    <div className="bg-white rounded-2xl border border-brand-line p-5 space-y-4">
      <h2 className="font-semibold text-brand-ink inline-flex items-center gap-2">
        <StickyNote size={16} className="text-brand-ink-soft" />
        Operator notes
      </h2>

      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value.slice(0, 2000))}
        placeholder="Anything the next operator should know about this order…"
        rows={4}
        className="w-full rounded-xl border border-brand-line bg-brand-cream/40 px-3 py-2 text-sm text-brand-ink placeholder:text-brand-ink-soft focus:outline-none focus:border-brand-red transition-colors resize-none"
      />
      <div className="flex items-center justify-between gap-3">
        <span className="text-[10px] font-mono text-brand-ink-soft tabular-nums">
          {notes.length}/2000
        </span>
        <button
          type="button"
          onClick={handleSaveNotes}
          disabled={!noteDirty || notesPending}
          className="inline-flex items-center gap-1.5 bg-brand-ink text-white text-xs font-semibold uppercase tracking-widest px-3 py-2 rounded-xl disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {notesPending ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Save size={14} />
          )}
          Save note
        </button>
      </div>
      {notesMsg && (
        <p
          className={`text-xs ${notesMsg.kind === "ok" ? "text-success" : "text-brand-red"}`}
        >
          {notesMsg.text}
        </p>
      )}

      {canRefund && (
        <div className="pt-4 border-t border-brand-line space-y-2">
          <p className="text-xs text-brand-ink-soft">
            Refunds settle to the buyer in 5-7 working days. Action is
            irreversible.
          </p>
          <button
            type="button"
            onClick={handleRefund}
            disabled={refundPending}
            className="w-full inline-flex items-center justify-center gap-2 border border-brand-red text-brand-red hover:bg-brand-red hover:text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors disabled:opacity-50"
          >
            {refundPending ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <RotateCcw size={14} />
            )}
            Refund {refundAmountLabel}
          </button>
          {refundMsg && (
            <p
              className={`text-xs ${refundMsg.kind === "ok" ? "text-success" : "text-brand-red"}`}
            >
              {refundMsg.text}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
