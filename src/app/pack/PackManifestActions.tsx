"use client";

import { useState, useTransition } from "react";
import { Truck, FileText, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { printManifestAction, schedulePickupAction } from "./actions";

export function PackManifestActions({ topackCount }: { topackCount: number }) {
  const [busy, startTransition] = useTransition();
  const [busyKind, setBusyKind] = useState<"manifest" | "pickup" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function handleManifest() {
    setError(null);
    setSuccess(null);
    setBusyKind("manifest");
    startTransition(async () => {
      const result = await printManifestAction();
      setBusyKind(null);
      if (result.ok) {
        window.open(result.manifestUrl, "_blank", "noopener");
        setSuccess(`Manifest opened for ${result.count} orders.`);
      } else {
        setError(result.error);
      }
    });
  }

  function handlePickup() {
    setError(null);
    setSuccess(null);
    setBusyKind("pickup");
    startTransition(async () => {
      const result = await schedulePickupAction();
      setBusyKind(null);
      if (result.ok) {
        setSuccess(
          `Pickup scheduled for ${result.count} orders` +
            (result.scheduledFor ? ` · ${result.scheduledFor}` : ""),
        );
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div className="sticky bottom-0 bg-[#0b0b0c]/95 backdrop-blur border-t border-white/10">
      <div className="max-w-5xl mx-auto px-4 py-3 flex flex-wrap items-center gap-2">
        <div className="text-xs font-mono uppercase tracking-widest text-white/50 mr-auto">
          {topackCount} order{topackCount === 1 ? "" : "s"} ready for courier
        </div>
        {error && (
          <p className="inline-flex items-center gap-1 text-xs text-brand-red font-medium">
            <AlertCircle size={12} />
            {error}
          </p>
        )}
        {success && (
          <p className="inline-flex items-center gap-1 text-xs text-success font-medium">
            <CheckCircle2 size={12} />
            {success}
          </p>
        )}
        <button
          onClick={handlePickup}
          disabled={busy}
          className="inline-flex items-center gap-1.5 bg-white/10 hover:bg-white/15 text-white text-xs font-semibold px-3 py-2 rounded-lg disabled:opacity-50"
        >
          {busyKind === "pickup" ? (
            <Loader2 size={13} className="animate-spin" />
          ) : (
            <Truck size={13} />
          )}
          Schedule pickup
        </button>
        <button
          onClick={handleManifest}
          disabled={busy}
          className="inline-flex items-center gap-1.5 bg-brand-red hover:bg-brand-red-hover text-white text-xs font-semibold px-3 py-2 rounded-lg disabled:opacity-50"
        >
          {busyKind === "manifest" ? (
            <Loader2 size={13} className="animate-spin" />
          ) : (
            <FileText size={13} />
          )}
          Print today&rsquo;s manifest
        </button>
      </div>
    </div>
  );
}
