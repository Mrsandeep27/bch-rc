import { defineConfig } from "drizzle-kit";

/**
 * Drizzle Kit config — used by `db:generate`, `db:push`, `db:studio`.
 *
 * Uses the DIRECT connection (DATABASE_URL, port 5432) for migrations because
 * the transaction pooler (port 6543) doesn't support all DDL operations.
 * Runtime queries should use DATABASE_URL_POOLED via src/db/index.ts.
 *
 * Env vars are loaded via `--env-file=.env.local` in the npm scripts.
 */
export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./src/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  verbose: true,
  strict: true,
});
