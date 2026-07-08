import { ShieldCheck, RefreshCw, Truck } from "lucide-react";

/**
 * Hub trust strip (after the hero) — the dark reliever badge row used on the
 * 1:64 store hero: COD · 7-day replacement · ships-24h. Dark bg, red icons,
 * uppercase mono labels, centered.
 */
const BADGES = [
  { icon: ShieldCheck, label: "COD available pan-India", short: "COD Pan-India" },
  { icon: RefreshCw, label: "7-day replacement", short: "7-Day Replace" },
  { icon: Truck, label: "Ships 24 hrs · Bangalore", short: "Ships 24 Hrs" },
];

export default function HubTrust() {
  return (
    <section className="border-t border-white/10 bg-brand-ink text-white">
      {/* Single line on every width — labels shorten on mobile so all 3 fit. */}
      <div className="mx-auto flex max-w-5xl flex-nowrap items-center justify-center gap-x-3 px-2 py-3.5 sm:gap-x-8 sm:px-6 sm:py-4">
        {BADGES.map(({ icon: Icon, label, short }) => (
          <span
            key={label}
            className="inline-flex items-center gap-1 whitespace-nowrap font-mono text-[9px] font-semibold uppercase tracking-wide sm:gap-2 sm:text-[13px] sm:tracking-wider"
          >
            <Icon strokeWidth={2.2} className="h-3.5 w-3.5 shrink-0 text-brand-red sm:h-4 sm:w-4" />
            <span className="sm:hidden">{short}</span>
            <span className="hidden sm:inline">{label}</span>
          </span>
        ))}
      </div>
    </section>
  );
}
