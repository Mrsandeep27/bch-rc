/**
 * One-time migration: promote the 1:16 store to a real siteId `prc16`.
 *
 * Idempotent + safe. DRY-RUN by default — it only prints what it WOULD change.
 * Re-run with APPLY=1 to execute inside a single transaction.
 *
 *   Dry run:  node --env-file=.env.local --import tsx scripts/migrate-prc16.ts
 *   Apply:    APPLY=1 node --env-file=.env.local --import tsx scripts/migrate-prc16.ts
 *
 * What it does:
 *   1. Insert the `prc16` sites row (ON CONFLICT DO NOTHING).
 *   2. Add `prc16` to every admin that already manages `prc`.
 *   3. Move the 1:16 inventory rows from siteId `prc` → `prc16` (PK move:
 *      insert-then-delete, preserving current stock).
 *   4. Reassign any 1:16 orders (+ their events/outbox) to `prc16`. (Currently 0.)
 *   5. Reassign `/16` analytics sessions + funnel events to `prc16`.
 *   6. Reassign 1:16 reviews + checkout leads to `prc16`.
 */
import { sql } from "drizzle-orm";
import { db } from "../src/db";
import { sites } from "../src/db/schema";
import { getStore16Skus } from "../src/lib/products";
import { THEME } from "../src/lib/theme";

const APPLY = process.env.APPLY === "1";
const SKUS = getStore16Skus().map((s) => s.id);
const skuArr = sql`array[${sql.join(SKUS.map((s) => sql`${s}`), sql`, `)}]::text[]`;

// Safe JSONB-array scan: some rows store `items` as a non-array (e.g. {}), and
// jsonb_array_elements throws on those. Coerce anything that isn't an array to
// an empty array so the scan never errors.
const itemsArr = (col: string) =>
  sql.raw(`CASE WHEN jsonb_typeof(${col}) = 'array' THEN ${col} ELSE '[]'::jsonb END`);

async function count(label: string, q: ReturnType<typeof sql>) {
  const r = await db.execute<{ n: number }>(sql`SELECT count(*)::int AS n FROM (${q}) t`);
  const n = (r as unknown as { n: number }[])[0]?.n ?? 0;
  console.log(`  ${label}: ${n}`);
  return n;
}

async function main() {
  console.log(`\n=== migrate-prc16 (${APPLY ? "APPLY" : "DRY-RUN"}) ===`);
  console.log("1:16 SKUs:", SKUS.join(", "), "\n");

  // checkout_leads is defined in schema but its migration may not be applied in
  // every environment. Detect it so we never error on a missing relation.
  const hasLeads =
    ((await db.execute<{ exists: boolean }>(
      sql`SELECT to_regclass('public.checkout_leads') IS NOT NULL AS exists`,
    )) as unknown as { exists: boolean }[])[0]?.exists ?? false;

  console.log("Will affect:");
  await count("inventory rows (prc → prc16)", sql`SELECT 1 FROM inventory WHERE site_id='prc' AND sku_id = ANY(${skuArr})`);
  await count("orders (prc → prc16)", sql`SELECT 1 FROM orders o WHERE o.site_id='prc' AND EXISTS (SELECT 1 FROM jsonb_array_elements(${itemsArr("o.items")}) it WHERE it->>'skuId' = ANY(${skuArr}))`);
  await count("analytics_sessions (/16 landing → prc16)", sql`SELECT 1 FROM analytics_sessions WHERE site_id='prc' AND landing_path LIKE '/16%'`);
  await count("funnel_events (/16 path → prc16)", sql`SELECT 1 FROM funnel_events WHERE site_id='prc' AND path LIKE '/16%'`);
  await count("reviews (1:16 sku → prc16)", sql`SELECT 1 FROM reviews WHERE site_id='prc' AND sku_id = ANY(${skuArr})`);
  if (hasLeads) {
    await count("checkout_leads (1:16 sku → prc16)", sql`SELECT 1 FROM checkout_leads l WHERE l.site_id='prc' AND EXISTS (SELECT 1 FROM jsonb_array_elements(${itemsArr("l.items")}) it WHERE it->>'skuId' = ANY(${skuArr}))`);
  } else {
    console.log("  checkout_leads: (table not in this DB — skipped)");
  }

  if (!APPLY) {
    console.log("\nDRY-RUN — nothing written. Re-run with APPLY=1 to execute.");
    process.exit(0);
  }

  console.log("\nApplying inside a transaction…");
  await db.transaction(async (tx) => {
    // 1. prc16 site row
    await tx
      .insert(sites)
      .values({
        id: "prc16",
        name: `${THEME.brandName} — Big (1:16)`,
        domain: "prc16.pocketrccars.com",
        scale: "1:16",
        orderIdPrefix: "PRC",
        brandTheme: {
          colors: THEME.colors,
          logo: { main: THEME.logoMain, dark: THEME.logoDark, badge: THEME.logoBadge, favicon: THEME.favicon },
          copy: { heroH1: THEME.heroH1, heroSub: THEME.heroSub, tagline: THEME.tagline },
        },
        gstin: THEME.legal.gstin,
        legalName: THEME.legal.legalName,
        registeredAddress: THEME.legal.registeredAddress,
        supportPhone: THEME.phoneDisplay,
        supportEmail: THEME.email,
      })
      .onConflictDoNothing({ target: sites.id });

    // 2. grant prc16 to admins that manage prc
    await tx.execute(sql`
      UPDATE admins
      SET site_ids = array_append(site_ids, 'prc16')
      WHERE 'prc' = ANY(site_ids) AND NOT ('prc16' = ANY(site_ids))
    `);

    // 3. inventory PK move (insert prc16 copy, then delete prc rows)
    await tx.execute(sql`
      INSERT INTO inventory (site_id, sku_id, variant_slug, stock, updated_at)
      SELECT 'prc16', sku_id, variant_slug, stock, now()
      FROM inventory WHERE site_id='prc' AND sku_id = ANY(${skuArr})
      ON CONFLICT (site_id, sku_id, variant_slug) DO NOTHING
    `);
    await tx.execute(sql`DELETE FROM inventory WHERE site_id='prc' AND sku_id = ANY(${skuArr})`);

    // 4. orders (+ cascade events/outbox). Reassign by 1:16 items.
    await tx.execute(sql`
      UPDATE orders o SET site_id='prc16', updated_at=now()
      WHERE o.site_id='prc' AND EXISTS (
        SELECT 1 FROM jsonb_array_elements(${itemsArr("o.items")}) it WHERE it->>'skuId' = ANY(${skuArr})
      )
    `);
    await tx.execute(sql`
      UPDATE events e SET site_id='prc16'
      WHERE e.site_id='prc' AND e.order_id IN (SELECT id FROM orders WHERE site_id='prc16')
    `);
    await tx.execute(sql`
      UPDATE notifications_outbox n SET site_id='prc16'
      WHERE n.site_id='prc' AND n.order_id IN (SELECT id FROM orders WHERE site_id='prc16')
    `);

    // 5. analytics sessions + funnel events on /16
    await tx.execute(sql`UPDATE analytics_sessions SET site_id='prc16' WHERE site_id='prc' AND landing_path LIKE '/16%'`);
    await tx.execute(sql`UPDATE funnel_events SET site_id='prc16' WHERE site_id='prc' AND path LIKE '/16%'`);

    // 6. reviews + leads
    await tx.execute(sql`UPDATE reviews SET site_id='prc16' WHERE site_id='prc' AND sku_id = ANY(${skuArr})`);
    if (hasLeads) {
      await tx.execute(sql`
        UPDATE checkout_leads l SET site_id='prc16'
        WHERE l.site_id='prc' AND EXISTS (
          SELECT 1 FROM jsonb_array_elements(${itemsArr("l.items")}) it WHERE it->>'skuId' = ANY(${skuArr})
        )
      `);
    }
  });

  console.log("✓ Applied. prc16 site created, inventory moved, traffic + any 1:16 orders reassigned.");
  process.exit(0);
}

main().catch((e) => {
  console.error("migrate-prc16 failed:", e instanceof Error ? e.message : e);
  process.exit(1);
});
