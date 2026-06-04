import { Boxes } from "lucide-react";
import { requireAdmin } from "@/lib/admin-auth";
import { getInventoryHealth, LOW_STOCK_THRESHOLD } from "@/lib/inventory";
import InventoryManager from "./InventoryManager";

export const dynamic = "force-dynamic";

export default async function AdminInventoryPage() {
  await requireAdmin();
  const health = await getInventoryHealth();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Boxes size={22} className="text-brand-red" />
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-brand-ink">
          Inventory health
        </h1>
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
