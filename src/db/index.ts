/**
 * Drizzle client — used by Next.js server-side code (route handlers, server actions).
 *
 * Connection strategy:
 * - Runtime queries (API routes, server components) → pooled connection (port 6543)
 *   for Vercel serverless. PgBouncer transaction mode, low connection count.
 * - Migrations (drizzle-kit push/generate) → direct connection (port 5432) via
 *   drizzle.config.ts.
 *
 * `prepare: false` is required by Supabase's pgBouncer transaction mode.
 */

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString =
  process.env.DATABASE_URL_POOLED ?? process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL_POOLED or DATABASE_URL must be set (see .env.local).",
  );
}

const queryClient = postgres(connectionString, {
  prepare: false,
  // Higher pool for dev where concurrent requests are common (admin page
  // fires ~5 queries in parallel). Serverless caps each function to its own
  // pool so 5 is safe per-instance.
  max: 5,
  idle_timeout: 20,
  max_lifetime: 60 * 30,
});

export const db = drizzle(queryClient, { schema });
export { schema };
