"use client";

/**
 * Merged Products browser — category chips (ported from the Inventory page's
 * "top category section") drive a card grid, with the status filter + sort
 * carried over from the old Products table. One category is active at a time
 * (search overrides it to sweep the whole catalogue). Cards are live: image,
 * price/MRP, status, colour swatches and summed stock from the inventory table.
 */

import { useMemo, useState, type CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronRight, Search, ArrowDownUp } from "lucide-react";
import { formatINR } from "@/lib/utils";

export type ProductCard = {
  id: string;
  slug: string;
  name: string;
  heroImage: string;
  scale: string;
  categoryKey: string;
  categoryLabel: string;
  retailINR: number;
  mrpINR: number;
  status: "active" | "coming" | "hidden";
  colors: { name: string; slug: string; swatch: string }[];
  stock: number | null; // summed live stock; null = no inventory row at all
};

type CategoryTab = { key: string; label: string; img: string | null };

type StatusKey = "all" | "active" | "coming" | "hidden";
const STATUS_TABS: { key: StatusKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "coming", label: "Coming soon" },
  { key: "hidden", label: "Hidden" },
];

type SortKey = "catalogue" | "price-asc" | "price-desc" | "stock-desc" | "name";

/** ColorVariant.swatch is either a solid hex or "gradient:c1,c2[,c3...]". */
function swatchStyle(swatch: string): CSSProperties {
  if (swatch.startsWith("gradient:")) {
    const stops = swatch.slice("gradient:".length).split(",").map((s) => s.trim()).filter(Boolean);
    return { backgroundImage: `linear-gradient(135deg, ${stops.join(", ")})` };
  }
  return { backgroundColor: swatch };
}

const STATUS_STYLE: Record<ProductCard["status"], { label: string; className: string }> = {
  active: { label: "Active", className: "bg-success/10 text-success" },
  coming: { label: "Coming soon", className: "bg-gold/10 text-gold" },
  hidden: { label: "Hidden", className: "bg-brand-ink-soft/10 text-brand-ink-soft" },
};

/** Live inventory state from the summed stock — honest about "no data". */
function invState(stock: number | null): { num: string; label: string; className: string } {
  if (stock === null) return { num: "—", label: "no data", className: "text-brand-ink-soft" };
  if (stock === 0) return { num: "0", label: "sold out", className: "text-brand-red" };
  if (stock <= 5) return { num: String(stock), label: "low stock", className: "text-gold" };
  return { num: stock.toLocaleString("en-IN"), label: "in stock", className: "text-success" };
}

export default function ProductsBrowser({
  products,
  categories,
}: {
  products: ProductCard[];
  categories: CategoryTab[];
}) {
  // Products per category (drives the chip counts + the default active chip).
  const catCount = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of categories) m.set(c.key, 0);
    for (const p of products) m.set(p.categoryKey, (m.get(p.categoryKey) ?? 0) + 1);
    return m;
  }, [products, categories]);

  const firstNonEmpty = useMemo(
    () => categories.find((c) => (catCount.get(c.key) ?? 0) > 0)?.key ?? categories[0]?.key ?? "",
    [categories, catCount],
  );

  const [activeCat, setActiveCat] = useState<string>(firstNonEmpty);
  const [status, setStatus] = useState<StatusKey>("all");
  const [sort, setSort] = useState<SortKey>("catalogue");
  const [search, setSearch] = useState("");

  const q = search.trim().toLowerCase();
  const searching = q.length > 0;

  // Base = the whole catalogue when searching, else the active category.
  const base = useMemo(() => {
    if (searching) return products.filter((p) => p.name.toLowerCase().includes(q) || p.slug.includes(q));
    return products.filter((p) => p.categoryKey === activeCat);
  }, [products, searching, q, activeCat]);

  const statusCount = useMemo(
    () => ({
      all: base.length,
      active: base.filter((p) => p.status === "active").length,
      coming: base.filter((p) => p.status === "coming").length,
      hidden: base.filter((p) => p.status === "hidden").length,
    }),
    [base],
  );

  const rows = useMemo(() => {
    let list = status === "all" ? base : base.filter((p) => p.status === status);
    switch (sort) {
      case "price-asc": list = [...list].sort((a, b) => a.retailINR - b.retailINR); break;
      case "price-desc": list = [...list].sort((a, b) => b.retailINR - a.retailINR); break;
      case "stock-desc": list = [...list].sort((a, b) => (b.stock ?? -1) - (a.stock ?? -1)); break;
      case "name": list = [...list].sort((a, b) => a.name.localeCompare(b.name)); break;
      default: break; // catalogue order
    }
    return list;
  }, [base, status, sort]);

  return (
    <div className="space-y-4">
      {/* ── Top category section (ported from Inventory) ── */}
      <div className="flex items-center gap-2 overflow-x-auto overflow-y-hidden no-scrollbar pb-1">
        {categories.map((c) => {
          const n = catCount.get(c.key) ?? 0;
          const empty = n === 0;
          const active = !searching && c.key === activeCat;
          return (
            <button
              key={c.key}
              type="button"
              onClick={() => { setActiveCat(c.key); setSearch(""); setStatus("all"); }}
              className={`shrink-0 inline-flex items-center gap-2 rounded-full py-1.5 pl-1.5 pr-3.5 text-sm font-semibold transition-colors ${
                active
                  ? "bg-brand-red text-white"
                  : empty
                    ? "bg-white border border-dashed border-brand-line text-brand-ink-soft/60"
                    : "bg-white border border-brand-line text-brand-ink-soft hover:text-brand-ink"
              }`}
            >
              <span
                className={`relative h-7 w-7 shrink-0 overflow-hidden rounded-full ${
                  active ? "ring-2 ring-white/70" : "ring-1 ring-black/5"
                } ${c.img ? "bg-white" : "border border-dashed border-brand-line bg-brand-cream"}`}
              >
                {c.img && <Image src={c.img} alt="" fill sizes="28px" className="object-cover" />}
              </span>
              {c.label}
              <span className={`tabular-nums text-xs ${active ? "text-white/70" : "text-brand-ink-soft"}`}>{n}</span>
            </button>
          );
        })}
      </div>

      {/* ── Toolbar: status tabs + search + sort (from Products) ── */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex max-w-full items-center gap-1 overflow-x-auto no-scrollbar rounded-xl border border-brand-line bg-white p-1">
          {STATUS_TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setStatus(t.key)}
              className={`shrink-0 whitespace-nowrap inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-semibold transition-colors ${
                t.key === status ? "bg-brand-cream text-brand-ink" : "text-brand-ink-soft hover:text-brand-ink"
              }`}
            >
              {t.label}
              <span
                className={`text-[11px] tabular-nums px-1.5 rounded-full ${
                  t.key === status ? "bg-brand-red text-white" : "bg-brand-line text-brand-ink-soft"
                }`}
              >
                {statusCount[t.key]}
              </span>
            </button>
          ))}
        </div>

        <div className="relative min-w-[9rem] flex-1 sm:flex-none sm:w-56">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-brand-ink-soft" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search all products"
            className="w-full pl-8 pr-3 py-2 rounded-xl border border-brand-line bg-white text-sm text-brand-ink focus:outline-none focus:border-brand-red"
          />
        </div>

        <label className="ml-auto inline-flex items-center gap-1.5 rounded-xl border border-brand-line bg-white px-2.5 py-2">
          <ArrowDownUp size={13} className="text-brand-ink-soft" />
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            aria-label="Sort products"
            className="bg-transparent text-sm text-brand-ink focus:outline-none"
          >
            <option value="catalogue">Sort: catalogue</option>
            <option value="price-asc">Price: low → high</option>
            <option value="price-desc">Price: high → low</option>
            <option value="stock-desc">Stock: high → low</option>
            <option value="name">Name A–Z</option>
          </select>
        </label>
      </div>

      {/* ── Card grid ── */}
      {rows.length === 0 ? (
        <div className="rounded-2xl border border-brand-line bg-white px-5 py-10 sm:py-16 text-center text-sm text-brand-ink-soft">
          {searching ? `No products match “${search.trim()}”.` : "No products in this category yet."}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2.5 sm:gap-3.5">
          {rows.map((p) => (
            <ProductGridCard key={p.id} p={p} />
          ))}
        </div>
      )}
    </div>
  );
}

function ProductGridCard({ p }: { p: ProductCard }) {
  const status = STATUS_STYLE[p.status];
  const inv = invState(p.stock);
  const colors = p.colors ?? [];

  const inner = (
    <>
      {/* Image */}
      <div className="relative aspect-[4/3] bg-brand-cream">
        <Image src={p.heroImage} alt={p.name} fill sizes="(max-width:768px) 50vw, 25vw" className="object-contain p-4" />
        <span
          className={`absolute left-2.5 top-2.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-black/5 ${status.className}`}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-current" />
          {status.label}
        </span>
        <span className="absolute right-2.5 top-2.5 rounded-md bg-white/85 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-brand-ink-soft ring-1 ring-black/5">
          {p.scale}
        </span>
      </div>

      {/* Body */}
      <div className="p-2.5 sm:p-3.5">
        <div className="font-semibold text-brand-ink text-sm truncate">{p.name}</div>
        <div className="text-xs text-brand-ink-soft mt-0.5">{p.categoryLabel}</div>

        <div className="mt-2 flex items-baseline gap-1.5">
          <span className="tabular-nums font-semibold text-brand-ink">{formatINR(p.retailINR)}</span>
          {p.mrpINR > p.retailINR && (
            <span className="text-brand-ink-soft line-through text-xs tabular-nums">{formatINR(p.mrpINR)}</span>
          )}
        </div>

        {colors.length > 0 && (
          <div className="mt-2.5 flex items-center gap-1.5">
            <span className="flex items-center gap-1">
              {colors.slice(0, 6).map((c) => (
                <span
                  key={c.slug}
                  title={c.name}
                  className="h-3 w-3 rounded-full border border-brand-line"
                  style={swatchStyle(c.swatch)}
                />
              ))}
            </span>
            <span className="text-xs text-brand-ink-soft">
              {colors.length} colour{colors.length === 1 ? "" : "s"}
            </span>
          </div>
        )}

        <div className="mt-3 flex items-center justify-between border-t border-brand-line pt-2.5">
          <span className={`text-[13px] font-semibold tabular-nums ${inv.className}`}>
            {inv.num} <span className="font-normal">{inv.label}</span>
          </span>
          <ChevronRight size={16} className="text-brand-ink-soft" />
        </div>
      </div>
    </>
  );

  const cardClass =
    "group block overflow-hidden rounded-2xl border border-brand-line bg-white transition-shadow hover:shadow-[0_4px_16px_rgba(0,0,0,0.07)] hover:border-brand-ink/20";

  // The card opens the in-admin edit view (stock is editable there). Every
  // product — including hidden ones — has an edit page keyed by its SKU id.
  return (
    <Link href={`/admin/products/${p.id}`} className={cardClass}>
      {inner}
    </Link>
  );
}
