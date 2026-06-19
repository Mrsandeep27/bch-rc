import { Loader2 } from "lucide-react";

/**
 * Loading state for /pack. Overrides the root product-grid skeleton
 * (src/app/loading.tsx) which is the homepage shape and looks wrong here.
 * Matches the light Packing Console chrome so the navigation feels in-context.
 */
export default function PackLoading() {
  return (
    <div className="min-h-screen bg-brand-cream flex items-center justify-center text-brand-ink-soft">
      <div className="inline-flex items-center gap-2 text-sm">
        <Loader2 size={16} className="animate-spin" />
        Loading packing console…
      </div>
    </div>
  );
}
