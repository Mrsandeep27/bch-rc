"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";

/**
 * Audience-data export. Two buttons that download a CSV from
 * /api/admin/export — Orders (who bought, from where, how they paid, what)
 * and Funnel events (every step a visitor took, where they dropped off).
 *
 * This is the "data out" half of studying the audience: download here, then
 * hand the CSV to Claude or open it in Excel. The repo itself has no audience
 * data — it all lives in the DB, and this is how you get it out.
 */
export function DataExport() {
  const [busy, setBusy] = useState<string | null>(null);

  async function download(dataset: "orders" | "funnel", label: string) {
    setBusy(dataset);
    try {
      const res = await fetch(`/api/admin/export?dataset=${dataset}`);
      if (!res.ok) {
        const msg = await res.text().catch(() => "");
        alert(`Export failed (${res.status}). ${msg}`);
        return;
      }
      const blob = await res.blob();
      // Pull the server-suggested filename out of Content-Disposition.
      const cd = res.headers.get("Content-Disposition") ?? "";
      const match = cd.match(/filename="?([^"]+)"?/);
      const filename = match?.[1] ?? `prc-${dataset}.csv`;

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      alert(`Could not download ${label}. Check your connection and retry.`);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="rounded-2xl border border-brand-line bg-white p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="font-semibold text-brand-ink flex items-center gap-2">
            <Download size={16} className="text-brand-red" /> Export audience
            data
          </h2>
          <p className="text-xs text-brand-ink-soft mt-1 max-w-md">
            Download a CSV, then hand it to Claude (or open in Excel) to study
            the audience — cities, payment mix, repeat buyers, where people drop
            off. The code has no audience data; this is how you get it out.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => download("orders", "orders CSV")}
            disabled={busy !== null}
            className="inline-flex items-center gap-2 rounded-full bg-brand-ink text-white text-sm font-semibold px-4 py-2 hover:bg-brand-ink/90 transition-colors disabled:opacity-50"
          >
            {busy === "orders" ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Download size={14} />
            )}
            Orders
          </button>
          <button
            type="button"
            onClick={() => download("funnel", "funnel CSV")}
            disabled={busy !== null}
            className="inline-flex items-center gap-2 rounded-full bg-white border border-brand-ink/15 text-brand-ink text-sm font-semibold px-4 py-2 hover:border-brand-ink transition-colors disabled:opacity-50"
          >
            {busy === "funnel" ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Download size={14} />
            )}
            Funnel <span className="text-brand-ink-soft font-normal">(30d)</span>
          </button>
        </div>
      </div>
    </div>
  );
}
