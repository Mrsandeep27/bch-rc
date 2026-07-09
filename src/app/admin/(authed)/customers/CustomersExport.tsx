"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";

/**
 * Customer CRM export. Downloads a site-scoped CSV from /api/admin/export
 * (name, phone, email, orders, spend, last order) — same download mechanics as
 * the dashboard's DataExport, scoped to a single button.
 */
export function CustomersExport() {
  const [busy, setBusy] = useState(false);

  async function download() {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/export?dataset=customers`);
      if (!res.ok) {
        const msg = await res.text().catch(() => "");
        alert(`Export failed (${res.status}). ${msg}`);
        return;
      }
      const blob = await res.blob();
      // Pull the server-suggested filename out of Content-Disposition.
      const cd = res.headers.get("Content-Disposition") ?? "";
      const match = cd.match(/filename="?([^"]+)"?/);
      const filename = match?.[1] ?? "prc-customers.csv";

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      alert("Could not download customers CSV. Check your connection and retry.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={download}
      disabled={busy}
      className="shrink-0 inline-flex items-center gap-2 rounded-xl bg-white border border-brand-line text-brand-ink text-xs sm:text-sm font-semibold px-3 py-2.5 sm:px-4 sm:py-2.5 hover:border-brand-ink transition-colors disabled:opacity-50"
    >
      {busy ? (
        <Loader2 size={14} className="animate-spin" />
      ) : (
        <Download size={14} />
      )}
      <span className="hidden sm:inline">Export CSV</span>
      <span className="sm:hidden">CSV</span>
    </button>
  );
}
