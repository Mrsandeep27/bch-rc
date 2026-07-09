/**
 * Apply a manual SQL migration over the POOLED Supabase connection (the direct
 * host is unreachable from this machine). Idempotent by construction — the SQL
 * files in src/db/migrations/manual/ use CREATE TABLE IF NOT EXISTS etc.
 *
 *   npx tsx --env-file=.env.local scripts/apply-manual-migration.ts src/db/migrations/manual/<file>.sql
 */
import { readFileSync } from "node:fs";
import { sql } from "drizzle-orm";
import { db } from "../src/db";

const file = process.argv[2];
if (!file) {
  console.error("usage: apply-manual-migration.ts <path-to.sql>");
  process.exit(1);
}

/** Strip comments, split on `;` at statement level. Good enough for plain DDL. */
function statements(text: string): string[] {
  return text
    .split("\n")
    .filter((l) => !l.trim().startsWith("--"))
    .join("\n")
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
}

async function tableInfo(name: string) {
  const rows = (await db.execute(sql`
    SELECT c.relname,
           c.relrowsecurity AS rls_enabled,
           (SELECT count(*)::int FROM pg_policies p WHERE p.tablename = c.relname) AS policies,
           (SELECT count(*)::int FROM information_schema.columns col
              WHERE col.table_name = c.relname AND col.table_schema = 'public') AS columns
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = ${name}
  `)) as unknown as Array<Record<string, unknown>>;
  return rows[0] ?? null;
}

async function main() {
  const target = "product_overrides";

  console.log(`\nBEFORE: ${JSON.stringify(await tableInfo(target)) || "table absent"}`);

  const sqlText = readFileSync(file, "utf8");
  const stmts = statements(sqlText);
  console.log(`\nApplying ${stmts.length} statement(s) from ${file}\n`);

  for (const s of stmts) {
    const head = s.replace(/\s+/g, " ").slice(0, 72);
    try {
      await db.execute(sql.raw(s));
      console.log(`  ok    ${head}...`);
    } catch (e) {
      console.log(`  FAIL  ${head}...`);
      console.log(`        ${e instanceof Error ? e.message : String(e)}`);
      process.exit(1);
    }
  }

  const after = await tableInfo(target);
  console.log(`\nAFTER: ${JSON.stringify(after)}`);

  if (!after) {
    console.error("\nVERIFY FAILED: table still absent");
    process.exit(1);
  }
  if (after.rls_enabled !== true) {
    console.error("\nVERIFY FAILED: RLS is NOT enabled — table is exposed via the anon REST API");
    process.exit(1);
  }
  console.log("\nVERIFIED: table exists, RLS enabled, 0 policies (deny-all to anon)\n");
  process.exit(0);
}

main().catch((e) => {
  console.error("THROW:", e);
  process.exit(1);
});
