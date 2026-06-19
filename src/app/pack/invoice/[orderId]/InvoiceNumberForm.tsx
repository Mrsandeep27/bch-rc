"use client";

import { useState, useTransition } from "react";
import { FileText } from "lucide-react";
import { setInvoiceNumberAction } from "../../actions";

/**
 * Entry gate shown when an order has no Zoho invoice number yet. The operator
 * pulls the number from Zoho Books and enters it here; on save the page
 * revalidates and the full tax invoice renders. Until then, no final invoice
 * can be printed/sent (Syed's requirement: number must come from Zoho).
 */
export function InvoiceNumberForm({
  orderId,
  current,
}: {
  orderId: string;
  current: string | null;
}) {
  const [value, setValue] = useState(current ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    setError(null);
    startTransition(async () => {
      const res = await setInvoiceNumberAction(orderId, value);
      if (!res.ok) setError(res.error);
      // On success the server action revalidates this path, so the page
      // re-renders with the invoice number set — no client redirect needed.
    });
  }

  return (
    <div className="mx-auto my-10 max-w-md rounded-2xl border border-neutral-300 bg-white p-6 shadow-sm">
      <div className="flex items-center gap-2 text-neutral-900">
        <FileText size={18} className="text-brand-red" />
        <h1 className="text-lg font-bold">Enter Zoho invoice number</h1>
      </div>
      <p className="mt-2 text-sm text-neutral-600">
        GST invoices are numbered in Zoho Books. Pull the invoice number for
        order <span className="font-mono font-semibold">{orderId}</span> from
        Zoho and enter it below. The branded invoice generates once saved.
      </p>
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") save();
        }}
        placeholder="e.g. INV-002145"
        className="mt-4 w-full rounded-lg border border-neutral-300 px-4 py-3 text-neutral-900 focus:border-brand-red focus:outline-none"
        autoFocus
      />
      {error && <p className="mt-2 text-sm text-brand-red">{error}</p>}
      <button
        type="button"
        onClick={save}
        disabled={pending || value.trim().length < 2}
        className="mt-4 w-full rounded-lg bg-neutral-900 px-4 py-3 font-semibold text-white hover:bg-neutral-800 disabled:opacity-50"
      >
        {pending ? "Saving…" : "Save & generate invoice"}
      </button>
    </div>
  );
}
