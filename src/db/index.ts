/**
 * Drizzle client — used by Next.js server-side code (route handlers, server actions).
 *
 * Connection strategy:
 * - Runtime queries (API routes, server components) → pooled connection
 *   (port 6543) via Supabase Supavisor in transaction mode.
 * - Migrations (drizzle-kit push/generate) → direct connection (port 5432).
 *
 * Vercel-serverless tuning (the difference between "works" and intermittent
 * `Connection closed` storms):
 *
 *   max: 1
 *     One connection per Lambda instance. Concurrent requests on Vercel
 *     spawn new container instances, each with its own pool of size 1, so
 *     total concurrency is governed by Lambda fan-out, not per-instance
 *     pooling. Lambdas are short-lived; a per-instance pool >1 just holds
 *     idle connections that the Supabase pooler / Vercel NAT will reap
 *     under us — when the pool hands one back, the next query sees
 *     "Connection closed".
 *
 *   idle_timeout: 20
 *     Evict our side of any connection that's been idle 20 s. Aligned with
 *     a typical Lambda invocation. Without this we keep dead sockets.
 *
 *   connect_timeout: 10
 *     Fail fast if the pooler is unreachable rather than blocking the
 *     function for its default 30 s.
 *
 *   prepare: false
 *     Required by Supavisor / pgBouncer transaction mode — prepared
 *     statements don't survive across transactions on a pooled session.
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
  // max: 3 — small enough to keep total pool footprint tiny across many
  // Lambda instances, large enough that a single request issuing 4-5
  // queries with Promise.all genuinely parallelises (key for the admin
  // overview page which fetches several aggregates at once).
  max: 3,
  idle_timeout: 20,
  connect_timeout: 10,
});

export const db = drizzle(queryClient, { schema });
export { schema };
