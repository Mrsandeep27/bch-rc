import { CarFront } from "lucide-react";

/**
 * Image placeholder for the 1:16 store. Every product/hero image slot uses this
 * until the real photography is wired in — so the layout is final and only the
 * <img> swaps later. Deliberately NEUTRAL grey (no blue): the slate-blue accent
 * is reserved for red-replacement spots only.
 */
export function Placeholder16({
  label = "Image coming soon",
  className = "",
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      className={`relative grid place-items-center overflow-hidden rounded-2xl border border-dashed border-neutral-300 bg-neutral-100 ${className}`}
      aria-label={label}
    >
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(45deg, #6b7280 0, #6b7280 1px, transparent 1px, transparent 12px)",
        }}
      />
      <div className="relative flex flex-col items-center gap-2 px-4 text-center">
        <CarFront className="h-8 w-8 text-neutral-400" aria-hidden />
        <span className="font-mono text-[10px] font-semibold uppercase tracking-widest text-neutral-500">
          {label}
        </span>
      </div>
    </div>
  );
}
