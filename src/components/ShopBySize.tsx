import Link from "next/link";
import Image from "next/image";
import { getSizes, SIZE_TEASER, type StoreScale } from "@/lib/store-sizes";

/**
 * "Shop by size" category section — sits right under the hero on BOTH stores
 * (1:64 main + 1:16 prc16). It's the visual front-door to the size catalogue:
 *
 *   ┌ light section ────────────────────────────────────────┐
 *   │  two live scales as 3-D pedestal discs, each car a     │
 *   │  transparent cutout BURSTING OUT above its circle      │
 *   │  (the Petronas-towers effect). The smaller 1:64 disc + │
 *   │  bigger 1:16 disc carry the "different size" story.    │
 *   └────────────────────────────────────────────────────────┘
 *   ┌ dark band ─────────────────────────────────────────────┐
 *   │  the unreleased scales (1:10 / 1:18 / 1:24 / 1:32) as   │
 *   │  ghost circles · "coming soon"                          │
 *   └────────────────────────────────────────────────────────┘
 *
 * Data (which scales are live, their hrefs + "You're here"/"Live" badges) is
 * reused verbatim from `getSizes()` — the same source the header size-switcher
 * uses — so this section can never drift out of sync with it.
 *
 * The car art in `public/sizes/<scale>.png` is a transparent cutout produced by
 * scripts/gen-size-cutout.py (Gemini photo-edit → magenta chroma-key). Because
 * it's a true cutout, the lower half sits over the disc and the roof/wing breaks
 * cleanly above the circle's top edge against the page — no rectangular photo
 * background like the old masked-photo version had.
 *
 * Theme-agnostic (reads brand-* CSS vars, identical on / and /16). Pure server
 * component — no client JS; all motion is CSS group-hover.
 */

type ScaleArt = {
  car: string;
  carW: number; // intrinsic px (for next/image)
  carH: number;
  carAlt: string;
  priceFrom: string;
  /** disc diameter — 1:64 reads smaller than 1:16 on purpose */
  disc: string;
  /** car width as a % of the disc, and how high it rides out of it */
  carScale: string;
  carLift: string;
};

const SCALE_META: Record<string, ScaleArt> = {
  "1:64": {
    car: "/sizes/1-64.png",
    carW: 1100,
    carH: 475,
    carAlt: "1:64 scale pocket RC drift car",
    priceFrom: "₹999",
    disc: "w-40 sm:w-52",
    carScale: "w-[155%]",
    carLift: "bottom-[34%]",
  },
  "1:16": {
    car: "/sizes/1-16.png",
    carW: 1330,
    carH: 456,
    carAlt: "1:16 scale big-series RC drift car",
    priceFrom: "₹2,899",
    disc: "w-52 sm:w-72",
    carScale: "w-[162%]",
    carLift: "bottom-[34%]",
  },
};

// Render the two live discs small→big regardless of which store we're on.
const LIVE_ORDER = ["1:64", "1:16"] as const;

// 3-D glossy puck: top highlight + bottom inner shade + outer drop shadow.
const DISC =
  "absolute inset-0 rounded-full ring-1 ring-black/10 " +
  "bg-[radial-gradient(circle_at_50%_30%,#ffffff_0%,#eef0f5_48%,#d4d8e1_100%)] " +
  "shadow-[0_34px_60px_-20px_rgba(18,22,40,0.5)] " +
  "transition-transform duration-500 group-hover:scale-[1.03]";

export default function ShopBySize({ current }: { current: StoreScale }) {
  const sizes = getSizes(current);
  const live = LIVE_ORDER.map((scale) => sizes.find((s) => s.scale === scale)).filter(
    (s): s is NonNullable<typeof s> => Boolean(s?.href),
  );
  const soon = sizes.filter((s) => !s.href);

  return (
    <>
      {/* ── Live scales ─────────────────────────────────────────────── */}
      <section
        id="shop-by-size"
        aria-labelledby="shop-by-size-h2"
        className="relative overflow-hidden bg-gradient-to-b from-white to-brand-cream py-8 sm:py-20"
      >
        <div className="mx-auto max-w-7xl px-5 sm:px-10">
          <div className="mb-6 text-center sm:mb-16">
            <span className="font-mono text-[11px] uppercase tracking-[0.25em] text-brand-red">
              Shop by size
            </span>
            <h2
              id="shop-by-size-h2"
              className="mt-2 font-display text-3xl font-bold text-brand-ink sm:text-5xl"
            >
              Pick your scale.
            </h2>
            <p className="mx-auto mt-3 max-w-md text-brand-ink-soft">
              Two sizes live today — pocket-size and big-series. More dropping soon.
            </p>
          </div>

          <div className="flex flex-col items-center gap-16 sm:flex-row sm:items-end sm:justify-center sm:gap-24">
            {live.map((s) => {
              const meta = SCALE_META[s.scale];
              if (!meta) return null;
              const here = s.badge === "You're here";
              const inner = (
                <>
                  {/* circle stage — overflow visible so the car bursts out */}
                  <div className={`relative aspect-square ${meta.disc}`}>
                    <div className={DISC} />
                    {/* contact shadow grounding the car onto the disc */}
                    <div className="absolute bottom-[24%] left-1/2 h-3.5 w-[58%] -translate-x-1/2 rounded-[50%] bg-black/25 blur-md transition-opacity duration-500 group-hover:opacity-75" />
                    {/* the cutout car, bursting out above the circle */}
                    <Image
                      src={meta.car}
                      alt={meta.carAlt}
                      width={meta.carW}
                      height={meta.carH}
                      sizes="(max-width: 640px) 70vw, 460px"
                      className={`absolute left-1/2 ${meta.carLift} ${meta.carScale} h-auto max-w-none -translate-x-1/2 drop-shadow-[0_22px_18px_rgba(0,0,0,0.34)] transition-transform duration-500 ease-out group-hover:-translate-y-2 group-hover:scale-[1.04]`}
                    />
                  </div>

                  {/* label */}
                  <div className="mt-6 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <span className="font-display text-2xl font-bold text-brand-ink sm:text-3xl">
                        {s.scale}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                          here
                            ? "bg-brand-red-soft text-brand-red"
                            : "bg-green-100 text-green-700"
                        }`}
                      >
                        {here ? "You're here" : "Live"}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-brand-ink-soft">{s.blurb}</p>
                    <p className="mt-1.5 font-mono text-xs uppercase tracking-widest text-brand-ink">
                      From {meta.priceFrom}
                    </p>
                  </div>
                </>
              );

              const cls =
                "group flex flex-col items-center rounded-3xl px-2 pt-6 outline-none focus-visible:ring-2 focus-visible:ring-brand-red";

              return s.external ? (
                <a key={s.scale} href={s.href} className={cls}>
                  {inner}
                </a>
              ) : (
                <Link key={s.scale} href={s.href!} className={cls}>
                  {inner}
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Coming soon (dark band) ─────────────────────────────────── */}
      {soon.length > 0 && (
        <section className="bg-brand-ink py-8 text-white sm:py-16">
          <div className="mx-auto max-w-5xl px-5 text-center sm:px-10">
            <span className="font-mono text-[11px] uppercase tracking-[0.3em] text-white/45">
              Coming soon
            </span>
            <h2 className="mt-2 font-display text-2xl font-bold sm:text-4xl">
              More sizes are on the way.
            </h2>
            <p className="mx-auto mt-3 max-w-md text-sm text-white/55">{SIZE_TEASER}</p>

            <ul className="mt-9 flex flex-wrap items-center justify-center gap-6 sm:gap-10">
              {soon.map((s) => (
                <li key={s.scale} className="flex flex-col items-center gap-2">
                  <span className="grid h-20 w-20 place-items-center rounded-full bg-white/[0.04] font-display text-lg font-bold text-white/75 ring-1 ring-inset ring-white/10 sm:h-24 sm:w-24 sm:text-xl">
                    {s.scale}
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-widest text-white/40">
                    {s.blurb}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}
    </>
  );
}
