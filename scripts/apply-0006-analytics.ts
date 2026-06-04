/**
 * One-off: apply ONLY migration 0006_analytics_sessions to the database,
 * without running drizzle-kit push/migrate (which would also try to apply the
 * in-progress 0007_manual_orders changes + hit an interactive truncate prompt
 * on the orders table).
 *
 * The 0006 SQL is idempotent (CREATE TABLE/INDEX IF NOT EXISTS + guarded FK),
 * so this is safe to run more than once. Uses the DIRECT connection
 * (DATABASE_URL, port 5432) like the migration tooling does.
 *
 *   node --env-file=.env.local --import tsx scripts/apply-0006-analytics.ts
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL not set");

const sqlText = readFileSync(
  join(process.cwd(), "src/db/migrations/0006_analytics_sessions.sql"),
  "utf8",
);

// Split on drizzle's breakpoint marker. Keep any chunk that still has SQL once
// comment lines are stripped (leading `--` comments before a statement are fine
// for Postgres, but a comment-only chunk would be an empty query).
const statements = sqlText
  .split("--> statement-breakpoint")
  .map((s) => s.trim())
  .filter((s) => s.replace(/^\s*--.*$/gm, "").trim().length > 0);

const client = postgres(url, { max: 1, prepare: false });

async function main() {
  console.log(`Applying 0006_analytics_sessions (${statements.length} statements)…`);
  for (const stmt of statements) {
    const preview = stmt.replace(/\s+/g, " ").slice(0, 70);
    process.stdout.write(`  → ${preview}…\n`);
    await client.unsafe(stmt);
  }

  // Verify the table now exists.
  const [{ exists }] = await client<{ exists: boolean }[]>`
    select exists (
      select 1 from information_schema.tables
      where table_schema = 'public' and table_name = 'analytics_sessions'
    ) as exists
  `;
  console.log(
    exists
      ? "✓ analytics_sessions table is present."
      : "✗ analytics_sessions table NOT found — something went wrong.",
  );
  await client.end();
  if (!exists) process.exit(1);
}

main().catch(async (err) => {
  console.error("Failed:", err);
  await client.end();
  process.exit(1);
});
