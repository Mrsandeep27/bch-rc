/**
 * Sync Shopify inventory from the frontend catalog.
 *  - colored variants  -> real per-color `stock` from products.ts
 *  - single-variant SKUs (no stock in code) -> DEFAULT_SINGLE placeholder
 * Enables inventory tracking + sets on-hand at the store's location.
 *
 * Dry run (default): prints the table, writes NOTHING.
 *   npx tsx scripts/sync-inventory.ts <token.json>
 * Apply:
 *   npx tsx scripts/sync-inventory.ts <token.json> --apply
 */
import { readFileSync } from "node:fs";
import { PRODUCTS } from "../src/lib/products";

const tokenPath = process.argv[2];
const APPLY = process.argv.includes("--apply");
const DEFAULT_SINGLE = 50; // placeholder stock for single-variant SKUs (edit in admin)

const cfg = JSON.parse(readFileSync(tokenPath, "utf8"));
const { store, apiVersion, adminToken } = cfg as {
  store: string; apiVersion: string; adminToken: string;
};

async function gql(query: string, variables: Record<string, unknown> = {}) {
  const r = await fetch(`https://${store}/admin/api/${apiVersion}/graphql.json`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": adminToken },
    body: JSON.stringify({ query, variables }),
  });
  return r.json();
}

// desired qty keyed by Shopify SKU string
const desired = new Map<string, { qty: number; placeholder: boolean }>();
for (const p of PRODUCTS as any[]) {
  if (p.hidden || p.internal) continue;
  if (p.colors && p.colors.length) {
    for (const c of p.colors) desired.set(`${p.slug}-${c.slug}`, { qty: c.stock ?? 0, placeholder: false });
  } else {
    desired.set(p.slug, { qty: DEFAULT_SINGLE, placeholder: true });
  }
}

async function main() {
  const loc = await gql(`{ locations(first: 1) { edges { node { id name } } } }`);
  const location = loc?.data?.locations?.edges?.[0]?.node;
  if (!location) { console.error("No location found:", JSON.stringify(loc).slice(0, 300)); process.exit(1); }
  console.log(`Location: ${location.name} (${location.id})\n`);

  // pull variants + inventoryItem ids
  const variants: { sku: string; invItemId: string; tracked: boolean; title: string }[] = [];
  let cursor: string | null = null;
  do {
    const res: any = await gql(
      `query($c:String){ products(first:50, after:$c){ pageInfo{ hasNextPage endCursor }
        edges{ node{ title variants(first:20){ edges{ node{ sku inventoryItem{ id tracked } } } } } } } }`,
      { c: cursor },
    );
    const conn = res.data.products;
    for (const pe of conn.edges) for (const ve of pe.node.variants.edges) {
      const v = ve.node;
      if (v.sku) variants.push({ sku: v.sku, invItemId: v.inventoryItem.id, tracked: v.inventoryItem.tracked, title: pe.node.title });
    }
    cursor = conn.pageInfo.hasNextPage ? conn.pageInfo.endCursor : null;
  } while (cursor);

  console.log(`${APPLY ? "APPLYING" : "DRY RUN"} — ${variants.length} variants\n`);
  let total = 0, applied = 0, errors = 0;
  for (const v of variants) {
    const want = desired.get(v.sku);
    if (!want) { console.log(`  (skip, no frontend match) ${v.sku}`); continue; }
    total += want.qty;
    const tag = want.placeholder ? " [placeholder]" : "";
    console.log(`  ${v.sku.padEnd(30)} -> ${String(want.qty).padStart(3)}${tag}${v.tracked ? "" : "  (enable tracking)"}`);
    if (!APPLY) continue;

    // 1) enable tracking
    const upd = await gql(
      `mutation($id:ID!){ inventoryItemUpdate(id:$id, input:{tracked:true}){ userErrors{ message } } }`,
      { id: v.invItemId },
    );
    const e1 = upd?.data?.inventoryItemUpdate?.userErrors;
    // 2) set on-hand
    const set = await gql(
      `mutation($input:InventorySetOnHandQuantitiesInput!){ inventorySetOnHandQuantities(input:$input){ userErrors{ message } } }`,
      { input: { reason: "correction", setQuantities: [{ inventoryItemId: v.invItemId, locationId: location.id, quantity: want.qty }] } },
    );
    const e2 = set?.data?.inventorySetOnHandQuantities?.userErrors;
    if ((e1 && e1.length) || (e2 && e2.length)) {
      errors++; console.log(`      ✗ ${JSON.stringify([...(e1||[]), ...(e2||[])])}`);
    } else applied++;
  }
  console.log(`\n${APPLY ? `Applied ${applied}, errors ${errors}.` : "Dry run only — no writes."}  Total units: ${total}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
