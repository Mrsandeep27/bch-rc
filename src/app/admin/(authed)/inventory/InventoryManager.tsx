"use client";

import { useMemo, useState } from "react";
import {
  Check,
  Loader2,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";

export type VariantItem = {
  skuId: string;
  variantSlug: string;
  skuName: string;
  colorName: string | null;
  stock: number | null;
  configured: boolean;
};

type UpdateResult = { ok: boolean; before: number | null; after: number; error?: string };

async function postUpdate(
  skuId: string,
  variantSlug: string,
  mode: "set" | "adjust",
  value: number,
): Promise<UpdateResult> {
  const r = await fetch("/api/admin/inventory", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ skuId, variantSlug, mode, value }),
  });
  const d = (await r.json()) as Partial<UpdateResult> & { error?: string };
  if (!r.ok) throw new Error(d.error || "Update failed");
  return { ok: true, before: d.before ?? null, after: d.after ?? 0 };
}

function VariantRow({
  item,
  onStockChange,
}: {
  item: VariantItem;
  onStockChange: (skuId: string, variantSlug: string, stock: number) => void;
}) {
  const [input, setInput] = useState<string>(String(item.stock ?? 0));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const stock = item.stock;
  const configured = stock !== null;

  async function run(mode: "set" | "adjust", value: number) {
    setBusy(true);
    setMsg(null);
    try {
      const res = await postUpdate(item.skuId, item.variantSlug, mode, value);
      setInput(String(res.after));
      setMsg({ kind: "ok", text: `Now ${res.after}` });
      // Lift the new value to the dashboard so the banner + stats recompute
      // locally — no full-page server refresh needed.
      onStockChange(item.skuId, item.variantSlug, res.after);
    } catch (e) {
      setMsg({ kind: "err", text: e instanceof Error ? e.message : "Failed" });
    } finally {
      setBusy(false);
    }
  }

  const badgeCls = !configured
    ? "bg-brand-red/10 text-brand-red"
    : (stock ?? 0) <= 0
      ? "bg-brand-red/10 text-brand-red"
      : (stock ?? 0) <= 5
        ? "bg-gold/15 text-gold"
        : "bg-success/10 text-success";

  return (
    <div className="flex flex-wrap items-center gap-2 py-2">
      <span className="w-28 shrink-0 text-sm text-brand-ink truncate">
        {item.colorName ?? "default"}
      </span>
      <span
        className={`font-mono text-xs font-semibold px-2 py-0.5 rounded-full ${badgeCls}`}
      >
        {configured ? stock : "not set"}
      </span>

      <div className="flex items-center gap-1.5 ml-auto">
        <input
          type="number"
          min={0}
          inputMode="numeric"
          value={input}
          onChange={(e) => setInput(e.target.value.replace(/[^\d]/g, ""))}
          disabled={busy}
          aria-label={`Set stock for ${item.skuName} ${item.colorName ?? ""}`}
          className="w-20 px-2 py-1.5 rounded-lg border border-brand-line focus:outline-none focus:border-brand-red text-brand-ink text-sm tabular-nums disabled:opacity-50"
        />
        <button
          type="button"
          onClick={() => run("set", Math.max(0, parseInt(input, 10) || 0))}
          disabled={busy}
          className="px-3 py-1.5 rounded-lg bg-brand-ink text-white text-xs font-semibold disabled:opacity-50"
        >
          {configured ? "Set" : "Create"}
        </button>
        <button
          type="button"
          onClick={() => run("adjust", 10)}
          disabled={busy}
          className="px-2.5 py-1.5 rounded-lg border border-brand-line text-brand-ink text-xs font-semibold hover:border-brand-red hover:text-brand-red disabled:opacity-50"
        >
          +10
        </button>
        <button
          type="button"
          onClick={() => run("adjust", 50)}
          disabled={busy}
          className="px-2.5 py-1.5 rounded-lg border border-brand-line text-brand-ink text-xs font-semibold hover:border-brand-red hover:text-brand-red disabled:opacity-50"
        >
          +50
        </button>
        <span className="w-24 text-xs">
          {busy ? (
            <Loader2 size={14} className="animate-spin text-brand-ink-soft" />
          ) : msg ? (
            <span
              className={`inline-flex items-center gap-1 ${msg.kind === "ok" ? "text-success" : "text-brand-red"}`}
            >
              {msg.kind === "ok" ? <Check size={12} /> : <AlertCircle size={12} />}
              {msg.text}
            </span>
          ) : null}
        </span>
      </div>
    </div>
  );
}

function FilterChip({
  label,
  count,
  active,
  tone,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  tone?: "warn" | "bad";
  onClick: () => void;
}) {
  const activeBg =
    tone === "bad"
      ? "bg-brand-red text-white"
      : tone === "warn"
        ? "bg-gold text-white"
        : "bg-brand-ink text-white";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
        active
          ? activeBg
          : "bg-white border border-brand-line text-brand-ink-soft hover:text-brand-ink"
      }`}
    >
      {label}
      <span
        className={`tabular-nums ${active ? "text-white/70" : "text-brand-ink-soft"}`}
      >
        {count}
      </span>
    </button>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "warn" | "bad";
}) {
  const valueCls =
    tone === "bad"
      ? "text-brand-red"
      : tone === "warn"
        ? "text-gold"
        : "text-brand-ink";
  return (
    <div className="bg-white rounded-2xl border border-brand-line p-4">
      <p className="text-xs font-mono font-bold uppercase tracking-widest text-brand-ink-soft">
        {label}
      </p>
      <p className={`font-display text-2xl font-bold mt-1 ${valueCls}`}>{value}</p>
    </div>
  );
}

type FilterMode = "all" | "low" | "soldout" | "missing";

export default function InventoryManager({
  initialItems,
  expectedCount,
  lowStockThreshold,
  orphanKeys,
}: {
  initialItems: VariantItem[];
  expectedCount: number;
  lowStockThreshold: number;
  orphanKeys: string[];
}) {
  const [items, setItems] = useState<VariantItem[]>(initialItems);
  const [filter, setFilter] = useState<FilterMode>("all");

  function onStockChange(skuId: string, variantSlug: string, stock: number) {
    setItems((prev) =>
      prev.map((it) =>
        it.skuId === skuId && it.variantSlug === variantSlug
          ? { ...it, stock, configured: true }
          : it,
      ),
    );
  }

  // All health figures derive from the live `items` state, so an edit updates
  // the banner + stats instantly without a server round-trip.
  const health = useMemo(() => {
    const configured = items.filter((i) => i.stock !== null);
    const missing = items.filter((i) => i.stock === null);
    const soldOut = configured.filter((i) => (i.stock ?? 0) <= 0);
    const lowStock = configured.filter(
      (i) => (i.stock ?? 0) > 0 && (i.stock ?? 0) <= lowStockThreshold,
    );
    const totalUnits = configured.reduce((s, i) => s + (i.stock ?? 0), 0);
    return {
      ok: missing.length === 0,
      configuredCount: configured.length,
      totalUnits,
      missing,
      soldOut,
      lowStock,
    };
  }, [items, lowStockThreshold]);

  // Apply the active filter BEFORE grouping, so a SKU with no matching
  // variants is hidden entirely (rather than rendering a header with an
  // empty body).
  const filtered = useMemo(() => {
    if (filter === "all") return items;
    if (filter === "low")
      return items.filter(
        (i) =>
          i.stock !== null &&
          (i.stock ?? 0) > 0 &&
          (i.stock ?? 0) <= lowStockThreshold,
      );
    if (filter === "soldout")
      return items.filter((i) => i.stock !== null && (i.stock ?? 0) <= 0);
    return items.filter((i) => i.stock === null); // "missing"
  }, [items, filter, lowStockThreshold]);

  // Group by SKU for a readable table.
  const bySku = useMemo(() => {
    const map = new Map<string, VariantItem[]>();
    for (const it of filtered) {
      const arr = map.get(it.skuName) ?? [];
      arr.push(it);
      map.set(it.skuName, arr);
    }
    return map;
  }, [filtered]);

  return (
    <div className="space-y-6">
      {/* Health banner */}
      {health.ok ? (
        <div className="flex items-start gap-3 rounded-2xl border border-success/30 bg-success/5 px-5 py-4">
          <CheckCircle2 size={20} className="text-success shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-brand-ink">
              All {expectedCount} orderable variants are configured.
            </p>
            <p className="text-sm text-brand-ink-soft mt-0.5">
              {health.totalUnits} units in stock across the catalogue. Checkout
              will not fail on missing inventory rows.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-3 rounded-2xl border border-brand-red/30 bg-brand-red/5 px-5 py-4">
          <AlertTriangle size={20} className="text-brand-red shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-brand-red">
              {health.missing.length} of {expectedCount} variants have NO
              inventory row — checkout will reject these orders.
            </p>
            <p className="text-sm text-brand-ink-soft mt-1">
              Fix it by running{" "}
              <code className="font-mono bg-brand-ink text-white px-1.5 py-0.5 rounded text-xs">
                npm run db:seed-inventory
              </code>{" "}
              (after <code className="font-mono text-xs">db:push</code>) against
              this environment, or set each variant&rsquo;s stock below.
            </p>
            <p className="text-xs text-brand-ink-soft mt-2">
              Missing:{" "}
              <span className="font-mono">
                {health.missing
                  .map((m) => `${m.skuId}:${m.variantSlug}`)
                  .join(", ")}
              </span>
            </p>
          </div>
        </div>
      )}

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Stat label="Configured" value={`${health.configuredCount}/${expectedCount}`} />
        <Stat label="Total units" value={String(health.totalUnits)} />
        <Stat label="Low stock" value={String(health.lowStock.length)} tone="warn" />
        <Stat label="Sold out" value={String(health.soldOut.length)} tone="bad" />
      </div>

      {/* Editable stock manager — restock + set starting stock */}
      <div className="bg-white rounded-2xl border border-brand-line overflow-hidden">
        <div className="px-5 py-4 border-b border-brand-line space-y-3">
          <div>
            <h2 className="font-semibold text-brand-ink">Manage stock</h2>
            <p className="text-xs text-brand-ink-soft mt-0.5">
              Restock arrivals with +10 / +50, or type an exact count and Set.
              &ldquo;Create&rdquo; gives a new catalogue variant its starting stock.
            </p>
          </div>
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
            <FilterChip
              label="All"
              count={items.length}
              active={filter === "all"}
              onClick={() => setFilter("all")}
            />
            <FilterChip
              label="Low stock"
              count={health.lowStock.length}
              active={filter === "low"}
              tone="warn"
              onClick={() => setFilter("low")}
            />
            <FilterChip
              label="Sold out"
              count={health.soldOut.length}
              active={filter === "soldout"}
              tone="bad"
              onClick={() => setFilter("soldout")}
            />
            <FilterChip
              label="Missing rows"
              count={health.missing.length}
              active={filter === "missing"}
              tone="bad"
              onClick={() => setFilter("missing")}
            />
          </div>
        </div>
        {bySku.size === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-brand-ink-soft">
            {filter === "low"
              ? `No variants under ${lowStockThreshold} units. Nice.`
              : filter === "soldout"
                ? "Nothing sold out. Every variant has stock."
                : filter === "missing"
                  ? "No missing inventory rows. Every catalogue variant is configured."
                  : "No variants to show."}
          </p>
        ) : (
          <ul className="divide-y divide-brand-line">
            {[...bySku.entries()].map(([skuName, variants]) => (
              <li key={skuName} className="px-5 py-3">
                <div className="font-semibold text-brand-ink text-sm mb-1">
                  {skuName}
                </div>
                {variants.map((v) => (
                  <VariantRow
                    key={`${v.skuId}:${v.variantSlug}`}
                    item={v}
                    onStockChange={onStockChange}
                  />
                ))}
              </li>
            ))}
          </ul>
        )}
      </div>

      {orphanKeys.length > 0 && (
        <p className="text-xs text-brand-ink-soft">
          Orphan rows (in DB but not in the catalogue):{" "}
          <span className="font-mono">{orphanKeys.join(", ")}</span>
        </p>
      )}
    </div>
  );
}
