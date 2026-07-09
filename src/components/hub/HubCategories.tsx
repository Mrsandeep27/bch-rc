"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";

/**
 * Hub — Categories (section 6). Circular tiles by type. One category is ALWAYS
 * shown (Mini RC Cars 64 open by default — no click needed); tapping another
 * tile switches the preview. The preview is NOT wrapped in a box: it shows the
 * category's 2 hero products as the REAL store product cards (same layout,
 * price block and PDP link as the store lineup) plus a "View Virtual Store" CTA.
 *
 * Prices mirror the live stores exactly: `online` = retail − ₹100 prepaid,
 * `off` = MRP→retail discount, `cod` = full retail (cash on delivery ceiling).
 */
type Product = {
  slug: string;
  img: string;
  name: string;
  scale: string;
  pick: string; // one-line "pick reason" eyebrow, like the store cards
  badge?: "NEW" | "PRO" | null;
  online: number; // prepaid price shown big
  mrp: number; // strikethrough anchor
  cod: number; // cash-on-delivery ceiling
  off: number; // % off (MRP → retail)
};
type Cat = {
  label: string;
  img: string | null; // circular tile image
  storeHref: string; // store home ("#" = not live)
  pdpBase: string; // product URL prefix, e.g. "/product/" or "/16/"
  products: Product[]; // [] → placeholder
};

const CATEGORIES: Cat[] = [
  {
    label: "Mini RC Cars 64",
    img: "/landing/cat-crawlers.webp",
    storeHref: "/",
    pdpBase: "/product/",
    products: [
      {
        slug: "pocket-monster",
        img: "/products/colors/PRC-monster-blue-v2.webp",
        name: "Pocket Monster Truck",
        scale: "1:64",
        pick: "Most gifted",
        online: 1799,
        mrp: 2699,
        cod: 1899,
        off: 30,
      },
      {
        slug: "pocket-f1-classic",
        img: "/products/colors/PRC-f1-classic-white-v2.webp",
        name: "Pocket F1 Classic",
        scale: "1:64",
        pick: "Beginner friendly",
        online: 1699,
        mrp: 2299,
        cod: 1799,
        off: 22,
      },
    ],
  },
  {
    label: "Big Drift 16",
    img: "/landing/cat-drift.webp",
    storeHref: "/16",
    pdpBase: "/16/",
    products: [
      {
        slug: "drift-inferno",
        img: "/store16-images/drift-inferno/1-hero.webp",
        name: "Drift Inferno",
        scale: "1:16",
        pick: "Everyday slider",
        badge: "NEW",
        online: 2899,
        mrp: 3999,
        cod: 2999,
        off: 25,
      },
      {
        slug: "dares-azure",
        img: "/store16-images/dares-azure/1-hero.webp",
        name: "Dares Azure",
        scale: "1:16",
        pick: "Flagship",
        badge: "PRO",
        online: 3499,
        mrp: 4999,
        cod: 3599,
        off: 28,
      },
    ],
  },
  { label: "1:20 Scale", img: null, storeHref: "#", pdpBase: "#", products: [] },
  { label: "1:43 Scale", img: null, storeHref: "#", pdpBase: "#", products: [] },
  { label: "Construction", img: null, storeHref: "#", pdpBase: "#", products: [] },
  { label: "Polo", img: null, storeHref: "#", pdpBase: "#", products: [] },
];

const inr = (n: number) => "₹" + n.toLocaleString("en-IN");

function TileImage({ c }: { c: Cat }) {
  if (c.img) {
    return (
      <Image src={c.img} alt={c.label} width={1254} height={1254} sizes="150px" className="h-full w-full object-cover" />
    );
  }
  return (
    <div className="flex h-full w-full items-center justify-center rounded-full border-2 border-dashed border-brand-line bg-white p-1 text-center font-mono text-[7px] uppercase leading-tight tracking-widest text-brand-ink-soft sm:p-4 sm:text-[10px]">
      image
      <br />
      coming
    </div>
  );
}

/** The real store product card: image + badge + scale/pick eyebrow + name +
 *  honest dual-price block, whole card links to the actual PDP. */
function PdpCard({ p, pdpBase }: { p: Product; pdpBase: string }) {
  return (
    <Link
      href={`${pdpBase}${p.slug}`}
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-brand-line bg-white shadow-md transition-all duration-300 hover:-translate-y-1 hover:border-brand-red/40 hover:shadow-xl"
    >
      <div className="relative aspect-square w-full overflow-hidden bg-brand-cream">
        <Image
          src={p.img}
          alt={p.name}
          fill
          sizes="(max-width: 640px) 45vw, 240px"
          className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
        />
        {p.badge && (
          <span className="absolute left-3 top-3 z-10 rounded-full bg-brand-red px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white shadow-md">
            {p.badge}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1.5 p-3 sm:gap-2 sm:p-4">
        <div className="-mb-1 flex items-center justify-between gap-2">
          <span className="font-mono text-[9px] uppercase tracking-widest text-brand-ink-soft sm:text-[10px]">{p.scale}</span>
          <span className="truncate font-mono text-[9px] font-semibold uppercase tracking-widest text-brand-red sm:text-[10px]">{p.pick}</span>
        </div>

        <span className="font-display text-sm font-bold leading-tight text-brand-ink transition-colors group-hover:text-brand-red sm:text-lg">
          {p.name}
        </span>

        <div className="-mt-0.5">
          <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 sm:gap-x-2">
            <span className="text-base font-bold text-brand-ink sm:text-xl">{inr(p.online)}</span>
            <span className="font-mono text-[9px] uppercase tracking-widest text-brand-ink-soft sm:text-[10px]">online</span>
            <span className="text-[11px] text-brand-ink-soft line-through sm:text-xs">{inr(p.mrp)}</span>
            <span className="font-mono text-[9px] font-semibold uppercase tracking-widest text-brand-red sm:text-[10px]">{p.off}% off</span>
          </div>
          <div className="mt-0.5 font-mono text-[10px] text-brand-ink-soft sm:text-[11px]">or {inr(p.cod)} cash on delivery</div>
        </div>

        <span className="mt-auto inline-flex items-center gap-1 pt-1 text-xs font-semibold text-brand-red sm:text-sm">
          View details
          <span aria-hidden className="transition-transform group-hover:translate-x-0.5">→</span>
        </span>
      </div>
    </Link>
  );
}

function PlaceholderCard({ className = "" }: { className?: string }) {
  return (
    <div className={`flex flex-col overflow-hidden rounded-2xl border-2 border-dashed border-brand-line bg-white/50 ${className}`}>
      <div className="grid aspect-square place-items-center bg-brand-cream/70 px-2 text-center font-mono text-[9px] uppercase tracking-widest text-brand-ink-soft sm:text-[10px]">
        new model
      </div>
      <div className="flex flex-1 flex-col gap-2 p-3 sm:p-4">
        <div className="h-2.5 w-2/3 rounded bg-brand-line" />
        <div className="h-3.5 w-1/2 rounded bg-brand-line" />
        <span className="mt-auto inline-flex w-fit rounded-full bg-brand-cream px-2.5 py-1 font-mono text-[9px] font-semibold uppercase tracking-widest text-brand-ink-soft sm:text-[10px]">
          Coming soon
        </span>
      </div>
    </div>
  );
}

/** Normal CTA pill, sitting to the SIDE of the two product cards (vertically
 *  centred on desktop; below them on mobile). Red when live, muted otherwise. */
function StoreCta({ href }: { href: string }) {
  if (href === "#") {
    return (
      <span className="inline-flex items-center gap-2 self-center whitespace-nowrap rounded-full border border-brand-line bg-white px-7 py-3 text-sm font-semibold text-brand-ink-soft">
        Coming soon
      </span>
    );
  }
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 self-center whitespace-nowrap rounded-full bg-brand-red px-7 py-3.5 text-base font-semibold text-white shadow-md transition-transform hover:scale-[1.03] active:scale-[0.97]"
    >
      View Virtual Store
      <ArrowRight size={18} aria-hidden />
    </Link>
  );
}

export default function HubCategories() {
  // Mini RC Cars 64 is open by default — a category is ALWAYS visible; tapping
  // a tile just switches which one (no closing to an empty state).
  const [open, setOpen] = useState(0);
  const sel = CATEGORIES[open];
  const live = sel.storeHref !== "#";

  return (
    <section aria-labelledby="hub-cats" className="bg-brand-cream py-8 sm:py-16">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <h2 id="hub-cats" className="text-center font-display text-2xl font-extrabold uppercase tracking-wider text-brand-ink sm:text-3xl">
          Categories
        </h2>

        {/* Mobile: one swipeable row, ~4 tiles visible (5th peeks to invite the
            swipe) so the section stays short and the page scrolls on to the
            preview. sm+: the full grid as before. */}
        <div className="no-scrollbar -mx-4 mt-8 flex snap-x snap-mandatory gap-3 overflow-x-auto overflow-y-hidden px-4 pb-2 sm:mx-0 sm:mt-10 sm:grid sm:snap-none sm:grid-cols-3 sm:gap-x-4 sm:gap-y-8 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-6">
          {CATEGORIES.map((c, i) => {
            const active = open === i;
            return (
              <button
                key={c.label}
                type="button"
                onClick={() => setOpen(i)}
                aria-pressed={active}
                className="group flex w-[20%] flex-none cursor-pointer snap-start flex-col items-center text-center sm:w-auto"
              >
                <span
                  className={`relative block aspect-square w-full overflow-hidden rounded-full bg-white ring-2 transition-all duration-300 group-hover:scale-105 sm:w-36 ${
                    active ? "ring-brand-red" : "ring-brand-line"
                  }`}
                >
                  <TileImage c={c} />
                </span>
                <span
                  className={`mt-2 max-w-[9rem] text-[11px] font-semibold leading-tight transition-colors sm:mt-3 sm:text-sm ${
                    active ? "text-brand-red" : "text-brand-ink group-hover:text-brand-red"
                  }`}
                >
                  {c.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* Preview — store cards (no box) with the CTA to the SIDE. */}
        <div className="mx-auto mt-8 max-w-6xl sm:mt-12">
          <div className="mb-4 flex items-baseline justify-between gap-3">
            <h3 className="font-display text-lg font-extrabold text-brand-ink sm:text-xl">{sel.label}</h3>
            <span className="font-mono text-[11px] uppercase tracking-widest text-brand-ink-soft">
              {sel.products.length ? "Tap a car for full details" : "Dropping soon"}
            </span>
          </div>

          {/* Three compact cards on the left (real products + one "coming soon"
              placeholder for the next model); a CTA column on the right that
              grows to fill the space and centres a short headline + the pill
              (so the button never floats alone). Stacks on mobile. */}
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:gap-10">
            <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:flex-1 lg:grid-cols-3">
              {sel.products.length > 0 ? (
                <>
                  {sel.products.map((p) => (
                    <PdpCard key={p.slug} p={p} pdpBase={sel.pdpBase} />
                  ))}
                  {/* one more slot, kept as a placeholder for the next model —
                      desktop only; on mobile just the 2 real cards show */}
                  <PlaceholderCard className="hidden sm:flex" />
                </>
              ) : (
                [1, 2, 3].map((n) => <PlaceholderCard key={n} className={n === 3 ? "hidden sm:flex" : ""} />)
              )}
            </div>

            <div className="flex flex-col items-center gap-2 text-center lg:w-72 lg:shrink-0 lg:gap-3 lg:border-l lg:border-brand-line/70 lg:pl-10">
              <p className="font-display text-lg font-extrabold text-brand-ink lg:text-xl">
                {live ? "Explore the full range" : "Dropping soon"}
              </p>
              {/* subline is desktop-only — on mobile the pill sits right under the cards */}
              <p className="hidden max-w-xs text-sm leading-relaxed text-brand-ink-soft lg:block">
                {live
                  ? `See every ${sel.label} model, colour and price inside the virtual store.`
                  : "We're shooting this range now — the drop lands on WhatsApp first."}
              </p>
              <StoreCta href={sel.storeHref} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
