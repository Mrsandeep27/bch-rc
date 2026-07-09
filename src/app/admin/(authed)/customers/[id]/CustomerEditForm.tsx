"use client";

import { useState, useTransition } from "react";
import { Check, Loader2, Pencil } from "lucide-react";
import { updateCustomer } from "./actions";

/**
 * Inline CRM editor for a customer's name, email, and notes. Calls the
 * updateCustomer server action, which validates + persists and revalidates the
 * profile. Notes had no edit UI before this — it's the whole point of the card.
 */
export function CustomerEditForm({
  id,
  initialName,
  initialEmail,
  initialNotes,
}: {
  id: string;
  initialName: string | null;
  initialEmail: string | null;
  initialNotes: string | null;
}) {
  const [name, setName] = useState(initialName ?? "");
  const [email, setEmail] = useState(initialEmail ?? "");
  const [notes, setNotes] = useState(initialNotes ?? "");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Baseline so we can disable Save until something actually changes and show a
  // subtle "unsaved" hint.
  const dirty =
    name !== (initialName ?? "") ||
    email !== (initialEmail ?? "") ||
    notes !== (initialNotes ?? "");

  function save() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const res = await updateCustomer(id, { name, email, notes });
      if (res.ok) {
        setSaved(true);
        // Clear the confirmation after a moment so it doesn't linger.
        setTimeout(() => setSaved(false), 2500);
      } else {
        setError(res.error ?? "Save failed.");
      }
    });
  }

  const inputCls =
    "w-full rounded-xl border border-brand-line bg-white px-3 py-2 text-sm text-brand-ink placeholder:text-brand-ink-soft focus:outline-none focus:border-brand-ink transition-colors disabled:opacity-60";
  const labelCls =
    "block text-[10px] font-mono font-bold uppercase tracking-widest text-brand-ink-soft mb-1.5";

  return (
    <section className="bg-white rounded-2xl border border-brand-line">
      <header className="px-3 py-3 sm:px-5 sm:py-4 border-b border-brand-line flex flex-wrap items-center gap-2">
        <Pencil size={15} className="text-brand-red" />
        <h2 className="font-semibold text-brand-ink">Customer details</h2>
        <span className="text-xs text-brand-ink-soft font-normal">
          — name, email &amp; internal notes
        </span>
      </header>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
        className="p-3 sm:p-5 space-y-3 sm:space-y-4"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          <div>
            <label htmlFor="cust-name" className={labelCls}>
              Name
            </label>
            <input
              id="cust-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={pending}
              maxLength={120}
              placeholder="Customer name"
              className={inputCls}
            />
          </div>
          <div>
            <label htmlFor="cust-email" className={labelCls}>
              Email
            </label>
            <input
              id="cust-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={pending}
              maxLength={200}
              placeholder="name@example.com"
              className={inputCls}
            />
          </div>
        </div>

        <div>
          <label htmlFor="cust-notes" className={labelCls}>
            Internal notes
          </label>
          <textarea
            id="cust-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={pending}
            rows={4}
            maxLength={5000}
            placeholder="Private CRM notes — call history, preferences, follow-ups. Never shown to the customer."
            className={`${inputCls} resize-y min-h-[96px]`}
          />
          <p className="text-[11px] text-brand-ink-soft mt-1">
            Only your team can see these notes.
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <button
            type="submit"
            disabled={pending || !dirty}
            className="inline-flex items-center gap-2 rounded-full bg-brand-ink text-white text-sm font-semibold px-5 py-2 hover:bg-brand-ink/90 transition-colors disabled:opacity-50"
          >
            {pending ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Check size={14} />
            )}
            {pending ? "Saving…" : "Save changes"}
          </button>

          {saved && (
            <span className="inline-flex items-center gap-1.5 text-sm text-success font-medium">
              <Check size={14} /> Saved
            </span>
          )}
          {error && <span className="text-sm text-brand-red">{error}</span>}
          {!error && !saved && dirty && (
            <span className="text-xs text-brand-ink-soft">Unsaved changes</span>
          )}
        </div>
      </form>
    </section>
  );
}
