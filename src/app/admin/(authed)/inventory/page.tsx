import { AlertTriangle, CheckCircle2, Boxes } from "lucide-react";
import { requireAdmin } from "@/lib/admin-auth";
import {
  getInventoryHealth,
  LOW_STOCK_THRESHOLD,
  type InventoryHealthItem,
} from "@/lib/inventory";

export const dynamic = "force-dynamic";

function stockBadge(item: InventoryHealthItem): { label: string; cls: string } {
  if (!item.configured)
    return { label: "NOT CONFIGURED", cls: "bg-brand-red/10 text-brand-red" };
  const stock = item.stock ?? 0;
  if (stock <= 0) return { label: "SOLD OUT", cls: "bg-brand-red/10 text-brand-red" };
  if (stock <= LOW_STOCK_THRESHOLD)
    return { label: `LOW · ${stock}`, cls: "bg-gold/15 text-gold" };
  return { label: `${stock}`, cls: "bg-success/10 text-success" };
}

export default async function AdminInventoryPage() {
  await requireAdmin();
  const health = await getInventoryHealth();

  // Group items by SKU for a readable table.
  const bySku = new Map<string, InventoryHealthItem[]>();
  for (const it of health.items) {
    const arr = bySku.get(it.skuName) ?? [];
    arr.push(it);
    bySku.set(it.skuName, arr);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Boxes size={22} className="text-brand-red" />
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-brand-ink">
          Inventory health
        </h1>
      </div>

      {/* Health banner */}
      {health.ok ? (
        <div className="flex items-start gap-3 rounded-2xl border border-success/30 bg-success/5 px-5 py-4">
          <CheckCircle2 size={20} className="text-success shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-brand-ink">
              All {health.expectedCount} orderable variants are configured.
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
              {health.missing.length} of {health.expectedCount} variants have NO
              inventory row — checkout will reject these orders.
            </p>
            <p className="text-sm text-brand-ink-soft mt-1">
              Fix it by running{" "}
              <code className="font-mono bg-brand-ink text-white px-1.5 py-0.5 rounded text-xs">
                npm run db:seed-inventory
              </code>{" "}
              (after <code className="font-mono text-xs">db:push</code>) against
              this environment.
            </p>
            <p className="text-xs text-brand-ink-soft mt-2">
              Missing:{" "}
              <span className="font-mono">
                {health.missing.map((m) => m.key).join(", ")}
              </span>
            </p>
          </div>
        </div>
      )}

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Stat label="Configured" value={`${health.configuredCount}/${health.expectedCount}`} />
        <Stat label="Total units" value={String(health.totalUnits)} />
        <Stat label="Low stock" value={String(health.lowStock.length)} tone="warn" />
        <Stat label="Sold out" value={String(health.soldOut.length)} tone="bad" />
      </div>

      {/* Per-SKU breakdown */}
      <div className="bg-white rounded-2xl border border-brand-line overflow-hidden">
        <div className="px-5 py-4 border-b border-brand-line">
          <h2 className="font-semibold text-brand-ink">Stock by variant</h2>
        </div>
        <ul className="divide-y divide-brand-line">
          {[...bySku.entries()].map(([skuName, variants]) => (
            <li key={skuName} className="px-5 py-3">
              <div className="font-semibold text-brand-ink text-sm">{skuName}</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {variants.map((v) => {
                  const b = stockBadge(v);
                  return (
                    <span
                      key={v.key}
                      className="inline-flex items-center gap-1.5 rounded-full border border-brand-line pl-2 pr-1 py-0.5 text-xs"
                    >
                      <span className="text-brand-ink-soft">
                        {v.colorName ?? "default"}
                      </span>
                      <span
                        className={`font-mono font-semibold px-1.5 py-0.5 rounded-full ${b.cls}`}
                      >
                        {b.label}
                      </span>
                    </span>
                  );
                })}
              </div>
            </li>
          ))}
        </ul>
      </div>

      {health.orphanKeys.length > 0 && (
        <p className="text-xs text-brand-ink-soft">
          Orphan rows (in DB but not in the catalogue):{" "}
          <span className="font-mono">{health.orphanKeys.join(", ")}</span>
        </p>
      )}
    </div>
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
