"use client";

import { useEffect } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";

export default function PackError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error("[/pack] uncaught error", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-[#0b0b0c] text-white flex items-center justify-center px-4">
      <div className="max-w-md text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-brand-red/15 text-brand-red mb-4">
          <AlertCircle size={24} />
        </div>
        <h1 className="font-display text-2xl font-bold">
          Pack console crashed.
        </h1>
        <p className="text-sm text-white/60 mt-2 break-words">
          {error.message || "Unknown error."}
        </p>
        {error.digest && (
          <p className="text-[10px] font-mono text-white/30 mt-2">
            ref: {error.digest}
          </p>
        )}
        <button
          onClick={() => reset()}
          className="mt-5 inline-flex items-center gap-1.5 bg-white/10 hover:bg-white/15 text-white text-sm font-semibold px-4 py-2 rounded-lg"
        >
          <RefreshCw size={14} /> Try again
        </button>
      </div>
    </div>
  );
}
