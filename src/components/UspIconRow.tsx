import { Zap, Shield, BadgeCheck, MapPin, type LucideIcon } from "lucide-react";
import { USPS } from "@/lib/copy";

const ICON_MAP: Record<string, LucideIcon> = {
  usbc: Zap,
  drop: Shield,
  shield: BadgeCheck,
  india: MapPin,
};

export default function UspIconRow() {
  return (
    <section className="py-10 sm:py-14 bg-white border-b border-brand-line">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6 max-w-6xl mx-auto px-4">
        {USPS.map((usp) => {
          const Icon = ICON_MAP[usp.iconKey] ?? Zap;
          return (
            <div
              key={usp.iconKey}
              className="flex flex-col items-center text-center"
            >
              <div className="w-14 h-14 rounded-full bg-brand-red-soft text-brand-red flex items-center justify-center mb-3">
                <Icon size={28} />
              </div>
              <p className="font-semibold text-sm sm:text-base text-brand-ink">
                {usp.title}
              </p>
              <p className="text-xs text-brand-ink-soft mt-1">{usp.sub}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
