/**
 * Non-interactive migration runner.
 *
 * Reads generated SQL files from src/db/migrations and applies them to the
 * direct-connection DATABASE_URL. Use this instead of `drizzle-kit push` —
 * push requires a TTY which Claude Code's PowerShell tool can't provide.
 *
 * Run: `npm run db:migrate`
 */

import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL not set");

  const sql = postgres(url, { max: 1, prepare: false });
  const db = drizzle(sql);

  console.log("Applying migrations to", url.replace(/:[^@]+@/, ":***@"));

  await migrate(db, { migrationsFolder: "./src/db/migrations" });

  console.log("✓ Migrations applied.");
  await sql.end();
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
  });
