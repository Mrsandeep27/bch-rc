/**
 * Side-scrolling marquee of brands that "make" the car —
 * manufacturer, tech, compliance, commerce trust signals.
 *
 * Pure CSS animation via .animate-marquee defined in globals.css.
 * Duplicates the list twice for seamless infinite loop.
 */
import { cn } from "@/lib/utils";

type Brand = {
  name: string;
};

const BRANDS: Brand[] = [
  { name: "TRASPED" },
  { name: "HENGGUAN" },
  { name: "2.4 GHz" },
  { name: "USB-C" },
  { name: "DIE-CAST ALLOY" },
  { name: "LED HEADLIGHTS" },
  { name: "MADE IN INDIA" },
  { name: "SHIPROCKET" },
  { name: "BIS COMPLIANT" },
];

function Item({ brand }: { brand: Brand }) {
  return (
    <div className="flex items-center justify-center shrink-0 px-8 sm:px-12 border-l border-brand-line/40 first:border-l-0">
      <span className="font-display text-brand-ink text-lg sm:text-xl font-bold tracking-tight whitespace-nowrap">
        {brand.name}
      </span>
    </div>
  );
}

export default function TrustMarquee({ className }: { className?: string }) {
  // Duplicated twice so the loop is seamless (translateX(-50%) reveals the second copy)
  const loop = [...BRANDS, ...BRANDS];

  return (
    <section
      className={cn(
        "relative bg-brand-cream border-y border-brand-line py-6 sm:py-8 overflow-hidden",
        className
      )}
      aria-label="Brands and certifications behind PRC Cars"
    >
      {/* Fade edges so items don't pop in/out harshly */}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-16 sm:w-24 bg-gradient-to-r from-brand-cream to-transparent z-10" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-16 sm:w-24 bg-gradient-to-l from-brand-cream to-transparent z-10" />

      <div className="flex items-center w-max animate-marquee">
        {loop.map((b, i) => (
          <Item key={`${b.name}-${i}`} brand={b} />
        ))}
      </div>
    </section>
  );
}
