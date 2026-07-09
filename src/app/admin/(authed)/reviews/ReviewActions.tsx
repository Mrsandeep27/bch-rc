"use client";

import { useState, useTransition } from "react";
import { Check, RotateCcw, Trash2, X } from "lucide-react";
import { approveReview, deleteReview, rejectReview, resetReview } from "./actions";

type ActionFn = (id: string) => Promise<{ ok: boolean; error?: string }>;

/**
 * Moderation buttons for one review. Calls the server actions; on success the
 * action revalidates the page, so the row moves to its new tab automatically.
 */
export function ReviewActions({ id, status }: { id: string; status: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(fn: ActionFn) {
    setError(null);
    startTransition(async () => {
      const res = await fn(id);
      if (!res.ok) setError(res.error ?? "Failed");
    });
  }

  function remove() {
    if (
      !window.confirm(
        "Delete this review permanently? This removes its photos from the storefront and cannot be undone.",
      )
    )
      return;
    run(deleteReview);
  }

  const base =
    "inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2.5 sm:py-1.5 rounded-lg border transition-colors disabled:opacity-50";

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {status !== "approved" && (
        <button
          type="button"
          onClick={() => run(approveReview)}
          disabled={pending}
          className={`${base} border-success/40 text-success hover:bg-success/10`}
        >
          <Check size={14} /> Approve
        </button>
      )}
      {status !== "rejected" && (
        <button
          type="button"
          onClick={() => run(rejectReview)}
          disabled={pending}
          className={`${base} border-brand-red/40 text-brand-red hover:bg-brand-red/10`}
        >
          <X size={14} /> Reject
        </button>
      )}
      {status !== "pending" && (
        <button
          type="button"
          onClick={() => run(resetReview)}
          disabled={pending}
          className={`${base} border-brand-line text-brand-ink-soft hover:bg-brand-cream`}
        >
          <RotateCcw size={14} /> Reset
        </button>
      )}
      <button
        type="button"
        onClick={remove}
        disabled={pending}
        title="Delete permanently"
        className={`${base} border-brand-red/40 text-brand-red hover:bg-brand-red hover:text-white`}
      >
        <Trash2 size={14} /> Delete
      </button>
      {error && <span className="text-xs text-brand-red">{error}</span>}
    </div>
  );
}
