"use client";

/**
 * Product edit view. The DEEP catalogue fields (title, tagline, description,
 * category) stay in code — they render read-only. What the admin CAN edit and
 * persist, via the DB "overrides" layer, is: PRICE, MRP, VISIBILITY, BADGE
 * (→ saveProductOverride) and per-colour STOCK (→ /api/admin/inventory). Price
 * edits flow to the PDP + the order-create pricing seam through the same
 * override, so the price shown is the price charged. Both kinds of change stage
 * as drafts and commit together from the sticky Save bar.
 */

import { useMemo, useState, type CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Check,
  Loader2,
  ExternalLink,
  Lock,
  RotateCcw,
  X,
} from "lucide-react";
import { formatINR } from "@/lib/utils";
import { saveProductOverride, clearProductOverride } from "./actions";

export type EditVariant = {
  slug: string;
  name: string;
  swatch: string | null;
  image: string | null;
  stock: number | null;
};

export type ProductDetail = {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  description: string;
  scale: string;
  categoryLabel: string;
  badge: string | null;
  retailINR: number;
  mrpINR: number;
  heroImage: string;
  status: "active" | "coming" | "hidden";
  overridden: boolean; // an override row exists in the DB
  variants: EditVariant[];
};

const BADGES = ["", "NEW", "BESTSELLER", "MOST GIFTED", "PRO"];
const VIS: { key: ProductDetail["status"]; label: string; sub: string }[] = [
  { key: "active", label: "Active on storefront", sub: "Shown in grid, sitemap, checkout" },
  { key: "coming", label: "Coming soon", sub: "Teaser tile, no buy button" },
  { key: "hidden", label: "Hidden (404)", sub: "Unreachable everywhere" },
];

function swatchStyle(swatch: string | null): CSSProperties {
  if (!swatch) return { background: "#e5e2dc" };
  if (swatch.startsWith("gradient:")) {
    const stops = swatch.slice("gradient:".length).split(",").map((s) => s.trim()).filter(Boolean);
    return { backgroundImage: `linear-gradient(135deg, ${stops.join(", ")})` };
  }
  return { backgroundColor: swatch };
}

const parseQty = (s: string): number | null => (s.trim() === "" ? null : Math.max(0, parseInt(s, 10) || 0));

async function postSet(skuId: string, variantSlug: string, value: number): Promise<number> {
  const r = await fetch("/api/admin/inventory", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ skuId, variantSlug, mode: "set", value }),
  });
  const d = (await r.json()) as { after?: number; error?: string };
  if (!r.ok) throw new Error(d.error || "Update failed");
  return d.after ?? value;
}

export default function ProductEditor({ detail }: { detail: ProductDetail }) {
  const router = useRouter();

  // ── Stock drafts (per variant) ──
  const [saved, setSaved] = useState<Record<string, number | null>>(() =>
    Object.fromEntries(detail.variants.map((v) => [v.slug, v.stock])),
  );
  const [drafts, setDrafts] = useState<Record<string, string>>(() =>
    Object.fromEntries(detail.variants.map((v) => [v.slug, v.stock === null ? "" : String(v.stock)])),
  );

  // ── Catalogue-override drafts ──
  const [price, setPrice] = useState(String(detail.retailINR));
  const [mrp, setMrp] = useState(String(detail.mrpINR));
  const [visibility, setVisibility] = useState<ProductDetail["status"]>(detail.status);
  const [badge, setBadge] = useState(detail.badge ?? "");

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const stockChanged = (slug: string): boolean => {
    const n = parseQty(drafts[slug] ?? "");
    return n !== null && n !== (saved[slug] ?? null);
  };
  const changedStock = useMemo(
    () => detail.variants.filter((v) => stockChanged(v.slug)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [drafts, saved, detail.variants],
  );

  const catalogueChanged =
    price !== String(detail.retailINR) ||
    mrp !== String(detail.mrpINR) ||
    visibility !== detail.status ||
    badge !== (detail.badge ?? "");

  const pendingCount = changedStock.length + (catalogueChanged ? 1 : 0);

  function setDraft(slug: string, value: string) {
    setDrafts((p) => ({ ...p, [slug]: value.replace(/[^\d]/g, "") }));
    setMsg(null);
  }

  function discard() {
    setDrafts(Object.fromEntries(detail.variants.map((v) => [v.slug, saved[v.slug] === null ? "" : String(saved[v.slug])])));
    setPrice(String(detail.retailINR));
    setMrp(String(detail.mrpINR));
    setVisibility(detail.status);
    setBadge(detail.badge ?? "");
    setMsg(null);
  }

  async function save() {
    setSaving(true);
    setMsg(null);
    let failed = 0;

    // 1) Catalogue override (price / MRP / visibility / badge)
    if (catalogueChanged) {
      const res = await saveProductOverride(detail.id, {
        priceInr: price.trim() === "" ? null : Math.max(0, parseInt(price, 10) || 0),
        mrpInr: mrp.trim() === "" ? null : Math.max(0, parseInt(mrp, 10) || 0),
        visibility,
        badge,
      });
      if (!res.ok) {
        setSaving(false);
        setMsg({ ok: false, text: res.error ?? "Couldn't save details." });
        return;
      }
    }

    // 2) Stock (per changed variant)
    const jobs = changedStock.map((v) => ({ slug: v.slug, value: parseQty(drafts[v.slug] ?? "") as number }));
    const queue = [...jobs];
    async function worker() {
      while (queue.length) {
        const nx = queue.shift();
        if (!nx) break;
        try {
          const after = await postSet(detail.id, nx.slug, nx.value);
          setSaved((p) => ({ ...p, [nx.slug]: after }));
        } catch {
          failed++;
        }
      }
    }
    await Promise.all([worker(), worker(), worker()]);

    setSaving(false);
    if (failed) {
      setMsg({ ok: false, text: `Saved details, but ${failed} stock update(s) failed — retry.` });
    } else {
      setMsg({ ok: true, text: "Saved." });
      router.refresh(); // re-pull server values so baselines reset
    }
  }

  async function reset() {
    if (!window.confirm("Remove all admin edits and revert this product to the catalogue values?")) return;
    setSaving(true);
    const res = await clearProductOverride(detail.id);
    setSaving(false);
    if (res.ok) {
      setMsg({ ok: true, text: "Reverted to catalogue." });
      router.refresh();
    } else {
      setMsg({ ok: false, text: res.error ?? "Couldn't reset." });
    }
  }

  const status = VIS.find((v) => v.key === visibility)!;

  return (
    <div className="space-y-3 sm:space-y-4 pb-24">
      {/* Breadcrumb + header */}
      <div>
        <Link href="/admin/products" className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-brand-ink-soft hover:text-brand-ink">
          <ArrowLeft size={14} /> All products
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-2 sm:gap-3">
          <h1 className="font-display text-lg sm:text-2xl font-bold text-brand-ink">{detail.name}</h1>
          {detail.overridden && (
            <span className="inline-flex items-center gap-1 rounded-full bg-brand-red/10 px-2.5 py-0.5 text-[11px] font-semibold text-brand-red">
              Edited
            </span>
          )}
          <div className="ml-auto flex items-center gap-2">
            {detail.overridden && (
              <button
                type="button"
                onClick={reset}
                disabled={saving}
                className="inline-flex items-center gap-1.5 rounded-lg border border-brand-line bg-white px-3 py-2 sm:py-1.5 text-[13px] font-semibold text-brand-ink-soft hover:text-brand-ink hover:border-brand-ink/30 disabled:opacity-50"
              >
                <RotateCcw size={13} /> Reset to catalogue
              </button>
            )}
            {visibility !== "hidden" && (
              <Link
                href={`/product/${detail.slug}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-brand-line bg-white px-3 py-2 sm:py-1.5 text-[13px] font-semibold text-brand-ink-soft hover:text-brand-ink hover:border-brand-ink/30"
              >
                View live <ExternalLink size={13} />
              </Link>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:gap-4 lg:grid-cols-[1.6fr_1fr]">
        {/* LEFT column */}
        <div className="space-y-3 sm:space-y-4">
          {/* Details (read-only — deep catalogue fields) */}
          <Card title="Details" locked>
            <Field label="Title"><ReadOnlyInput value={detail.name} /></Field>
            <Field label="Tagline"><ReadOnlyInput value={detail.tagline} /></Field>
            <Field label="Description">
              <textarea readOnly value={detail.description} rows={2}
                className="w-full resize-none rounded-lg border border-brand-line bg-brand-cream/40 px-3 py-2 text-sm text-brand-ink-soft focus:outline-none" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Category"><ReadOnlyInput value={detail.categoryLabel} /></Field>
              <Field label="Badge">
                <select value={badge} onChange={(e) => { setBadge(e.target.value); setMsg(null); }}
                  className="w-full rounded-lg border border-brand-line bg-white px-3 py-2 text-sm text-brand-ink focus:outline-none focus:border-brand-red">
                  {BADGES.map((b) => (
                    <option key={b || "none"} value={b}>{b === "" ? "No badge" : b}</option>
                  ))}
                </select>
              </Field>
            </div>
          </Card>

          {/* Colours & variants — EDITABLE stock */}
          <div className="rounded-2xl border border-brand-line bg-white overflow-hidden">
            <div className="flex items-center gap-2 border-b border-brand-line px-3 sm:px-4 py-3">
              <span className="text-sm font-bold text-brand-ink">Colours &amp; variants</span>
              <span className="text-xs text-brand-ink-soft">{detail.variants.length} variant{detail.variants.length === 1 ? "" : "s"}</span>
            </div>
            <div className="divide-y divide-brand-line">
              {detail.variants.map((v) => {
                const cur = saved[v.slug];
                const draft = drafts[v.slug] ?? "";
                const chg = stockChanged(v.slug);
                const next = parseQty(draft);
                const up = chg && next !== null && next > (cur ?? 0);
                return (
                  <div key={v.slug || "default"} className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2.5">
                    <span className="h-8 w-8 shrink-0 rounded-lg overflow-hidden bg-brand-cream ring-1 ring-black/5 grid place-items-center">
                      {v.image ? <Image src={v.image} alt="" width={32} height={32} className="h-full w-full object-cover" />
                        : <span className="h-3.5 w-3.5 rounded-full ring-1 ring-black/10" style={swatchStyle(v.swatch)} />}
                    </span>
                    <span className="h-3.5 w-3.5 shrink-0 rounded-full ring-1 ring-black/10" style={swatchStyle(v.swatch)} />
                    <span className="min-w-0 flex-1 text-sm font-medium text-brand-ink truncate">{v.name}</span>
                    {cur === null && <span className="text-[11px] font-semibold text-brand-ink-soft">no row yet</span>}
                    <div className="flex items-center gap-2">
                      <label className="hidden sm:block text-[11px] font-semibold uppercase tracking-wide text-brand-ink-soft">Stock</label>
                      <input type="text" inputMode="numeric" value={draft} placeholder={cur === null ? "0" : String(cur)}
                        onChange={(e) => setDraft(v.slug, e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                        aria-label={`Stock for ${detail.name} ${v.name}`}
                        className={`w-20 rounded-lg border px-2.5 py-2 sm:py-1.5 text-sm text-right font-semibold tabular-nums focus:outline-none ${
                          chg ? (up ? "border-success bg-success/5 text-success" : "border-brand-red bg-brand-red/5 text-brand-red")
                              : "border-brand-line text-brand-ink focus:border-brand-red"}`} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* RIGHT column */}
        <div className="space-y-3 sm:space-y-4">
          {/* Pricing — EDITABLE */}
          <Card title="Pricing">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Price (₹)">
                <input type="text" inputMode="numeric" value={price}
                  onChange={(e) => { setPrice(e.target.value.replace(/[^\d]/g, "")); setMsg(null); }}
                  className="w-full rounded-lg border border-brand-line bg-white px-3 py-2 text-sm tabular-nums text-brand-ink focus:outline-none focus:border-brand-red" />
              </Field>
              <Field label="MRP (₹)">
                <input type="text" inputMode="numeric" value={mrp}
                  onChange={(e) => { setMrp(e.target.value.replace(/[^\d]/g, "")); setMsg(null); }}
                  className="w-full rounded-lg border border-brand-line bg-white px-3 py-2 text-sm tabular-nums text-brand-ink focus:outline-none focus:border-brand-red" />
              </Field>
            </div>
            <p className="text-[11px] text-brand-ink-soft">
              Current: {formatINR(detail.retailINR)}{detail.mrpINR > detail.retailINR && <> · MRP {formatINR(detail.mrpINR)}</>}. Changing price updates the PDP <b>and</b> checkout.
            </p>
          </Card>

          {/* Visibility — EDITABLE */}
          <Card title="Visibility">
            <div className="space-y-1">
              {VIS.map((v) => (
                <label key={v.key} className={`flex items-center gap-3 rounded-lg px-2 py-1.5 cursor-pointer ${visibility === v.key ? "bg-brand-cream" : "hover:bg-brand-cream/50"}`}>
                  <input type="radio" name="visibility" checked={visibility === v.key}
                    onChange={() => { setVisibility(v.key); setMsg(null); }}
                    className="accent-brand-red" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-brand-ink">{v.label}</span>
                    <span className="block text-xs text-brand-ink-soft">{v.sub}</span>
                  </span>
                </label>
              ))}
            </div>
            <p className="text-[11px] text-brand-ink-soft mt-1">Now: <b>{status.label}</b></p>
          </Card>
        </div>
      </div>

      {/* Sticky save bar */}
      {pendingCount > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-brand-line bg-white/95 backdrop-blur px-3 py-2.5 sm:px-4 sm:py-3 shadow-[0_-4px_20px_rgba(0,0,0,0.06)]">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2 sm:gap-3 lg:pl-56">
            <span className="text-sm text-brand-ink">
              <span className="font-semibold">{pendingCount}</span> unsaved change{pendingCount === 1 ? "" : "s"}
              {msg && <span className={`ml-2 ${msg.ok ? "text-success" : "text-brand-red"}`}>· {msg.text}</span>}
            </span>
            <div className="ml-auto flex items-center gap-2">
              <button type="button" onClick={discard} disabled={saving}
                className="inline-flex items-center gap-1 rounded-lg border border-brand-line px-3 py-2 text-sm font-semibold text-brand-ink-soft hover:text-brand-ink disabled:opacity-40">
                <X size={14} /> Discard
              </button>
              <button type="button" onClick={save} disabled={saving}
                className="inline-flex items-center gap-1.5 rounded-lg bg-brand-red px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">
                {saving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                Save {pendingCount} change{pendingCount === 1 ? "" : "s"}
              </button>
            </div>
          </div>
        </div>
      )}

      {msg && pendingCount === 0 && (
        <p className={`inline-flex items-center gap-1.5 text-sm ${msg.ok ? "text-success" : "text-brand-red"}`}>
          <Check size={14} /> {msg.text}
        </p>
      )}
    </div>
  );
}

function Card({ title, locked, children }: { title: string; locked?: boolean; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-brand-line bg-white overflow-hidden">
      <div className="flex items-center gap-2 border-b border-brand-line px-3 sm:px-4 py-3">
        <span className="text-sm font-bold text-brand-ink">{title}</span>
        {locked && (
          <span className="ml-auto inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-brand-ink-soft">
            <Lock size={10} /> in code
          </span>
        )}
      </div>
      <div className="space-y-3 p-3 sm:p-4">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-brand-ink-soft">{label}</span>
      {children}
    </label>
  );
}

function ReadOnlyInput({ value }: { value: string }) {
  return (
    <input readOnly value={value}
      className="w-full rounded-lg border border-brand-line bg-brand-cream/40 px-3 py-2 text-sm text-brand-ink-soft focus:outline-none" />
  );
}
