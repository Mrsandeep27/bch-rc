"use client";

import { Printer } from "lucide-react";

/**
 * Print trigger for the invoice page. Client component so it can call
 * window.print(). The browser's print dialog lets the packer "Save as PDF"
 * or send straight to a printer.
 */
export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-neutral-900 hover:bg-neutral-200"
    >
      <Printer size={16} aria-hidden />
      Print / Save PDF
    </button>
  );
}
