import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { STORE16_PRODUCTS, formatINR16 } from "@/lib/store16";
import { OFFERS } from "@/lib/config";
import { Placeholder16 } from "./Placeholder16";

/**
 * PDP cross-sell — "Complete the garage". A horizontal rail of the OTHER 1:16
 * products (the one being viewed is excluded) so a product page is never a dead
 * end. The whole card links to that product's PDP. Mirrors the Lineup card
 * visuals, trimmed down (no buy buttons — it's a browse-on affordance).
 */
export default function RelatedProducts16({ currentSlug }: { currentSlug: string }) {
  const others = STORE16_PRODUCTS.filter((p) => p.slug !== currentSlug);
  if (others.length === 0) return null;

  return (
    <section className="border-t border-brand-line bg-brand-cream py-7 sm:py-14">
      <div className="mx-auto max-w-7xl px-5 sm:px-10">
        <div className="mb-6 text-center sm:mb-8">
          <span className="font-mono text-[11px] uppercase tracking-[0.25em] text-brand-red">
            More from the lineup
          </span>
          <h2 className="mt-2 font-display text-3xl font-bold text-brand-ink sm:text-4xl">
            Complete the garage.
          </h2>
        </div>

        <div className="-mx-5 flex snap-x snap-mandatory gap-4 overflow-x-auto overflow-y-hidden px-5 pb-4 no-scrollbar sm:-mx-10 sm:gap-6 sm:px-10">
          {others.map((p) => {
            const onlinePrice = p.priceINR - OFFERS.prepaidDiscountINR;
            return (
              <Link
                key={p.slug}
                href={`/16/${p.slug}`}
                className="group flex w-[70%] shrink-0 snap-center flex-col overflow-hidden rounded-2xl border border-brand-line bg-white shadow-md transition-all duration-300 hover:-translate-y-1 hover:border-brand-red/40 hover:shadow-xl sm:w-[240px]"
              >
                {p.heroImage ? (
                  <div className="relative aspect-square w-full overflow-hidden bg-brand-cream">
                    <Image
                      src={p.heroImage}
                      alt={p.name}
                      fill
                      sizes="(max-width: 640px) 70vw, 240px"
                      className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                    />
                  </div>
                ) : (
                  <Placeholder16
                    label={p.name}
                    className="aspect-square w-full rounded-none border-0"
                  />
                )}

                <div className="flex flex-1 flex-col gap-2 p-4">
                  <div className="flex items-center gap-2">
                    <span
                      aria-hidden
                      className="h-3 w-3 shrink-0 rounded-full border border-brand-line"
                      style={
                        p.swatch2
                          ? { background: `linear-gradient(135deg, ${p.swatch} 50%, ${p.swatch2} 50%)` }
                          : { background: p.swatch }
                      }
                    />
                    <span className="font-mono text-[10px] uppercase tracking-widest text-brand-ink-soft">
                      {p.colorway}
                    </span>
                  </div>

                  <span className="font-display text-lg font-bold leading-tight text-brand-ink transition-colors group-hover:text-brand-red">
                    {p.name}
                  </span>

                  <div className="mt-auto flex items-baseline gap-2 pt-1">
                    <span className="text-lg font-bold text-brand-ink">
                      {formatINR16(onlinePrice)}
                    </span>
                    <span className="font-mono text-[10px] uppercase tracking-widest text-brand-ink-soft">
                      online
                    </span>
                  </div>
                  <span className="inline-flex items-center gap-1 font-mono text-[11px] font-semibold uppercase tracking-widest text-brand-red">
                    View
                    <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
