import Link from "next/link";
import { Boxes } from "lucide-react";
import { requireAdmin } from "@/lib/admin-auth";
import { getInventoryHealth, LOW_STOCK_THRESHOLD } from "@/lib/inventory";
import InventoryManager from "./InventoryManager";

export const dynamic = "force-dynamic";

export default async function AdminInventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ site?: string }>;
}) {
  const ctx = await requireAdmin();
  const sp = await searchParams;
  // Inventory is per-store (a SKU lives under exactly one site), so this page
  // shows ONE store at a time — default to the admin's first site.
  const site =
    sp.site && ctx.siteIds.includes(sp.site) ? sp.site : ctx.siteIds[0];
  const health = await getInventoryHealth(site);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Boxes size={22} className="text-brand-red" />
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-brand-ink">
            Inventory health
          </h1>
        </div>
        {ctx.siteIds.length > 1 && (
          <div className="flex gap-1 bg-brand-cream rounded-full p-1">
            {ctx.siteIds.map((s) => (
              <Link
                key={s}
                href={`/admin/inventory?site=${s}`}
                className={`px-3 py-1.5 rounded-full text-sm font-medium uppercase transition-colors ${
                  s === site
                    ? "bg-brand-ink text-white"
                    : "text-brand-ink-soft hover:text-brand-ink"
                }`}
              >
                {s}
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Banner, stats and the editable manager are all driven client-side from
          the initial snapshot, so each stock edit updates them locally without
          a full-page server refresh. */}
      <InventoryManager
        initialItems={health.items.map((i) => ({
          skuId: i.skuId,
          variantSlug: i.variantSlug,
          skuName: i.skuName,
          colorName: i.colorName,
          stock: i.stock,
          configured: i.configured,
        }))}
        expectedCount={health.expectedCount}
        lowStockThreshold={LOW_STOCK_THRESHOLD}
        orphanKeys={health.orphanKeys}
      />
    </div>
  );
}
