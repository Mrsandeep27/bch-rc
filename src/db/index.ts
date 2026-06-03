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

// Cache the postgres-js client on globalThis. Without this, Next.js dev
// HMR creates a fresh pool every time this module is re-evaluated (which
// happens whenever any file in its import graph changes); the old pool's
// TCP sockets linger in the background. Over a long dev session you
// accumulate orphaned sockets — the next time one is handed back to the
// app the server-side state is inconsistent and the first query on it
// hangs until Postgres' statement_timeout cancels it, surfacing as
// "PostgresError: canceling statement due to statement timeout" on a
// trivial indexed SELECT. In production each Lambda cold-start re-evaluates
// the module once, so the cache is a harmless no-op there.
//
// max_lifetime: 5 minutes. The Supabase Supavisor pooler holds idle
// upstream connections for a finite window. Without an aggressive
// max_lifetime, a long-lived Lambda instance can hand back a postgres-js
// connection whose Supavisor counterpart has already been reaped — same
// failure mode as the HMR-orphan case. Five minutes is well under any
// pooler keepalive threshold and frequent enough that no connection ever
// sees stale upstream state.
//
// max: 3 — small per-Lambda pool, big enough for one Promise.all of 4-5
// admin aggregates to genuinely parallelise.
const globalForDb = globalThis as unknown as {
  __pgClient?: ReturnType<typeof postgres>;
};

const queryClient =
  globalForDb.__pgClient ??
  postgres(connectionString, {
    prepare: false,
    max: 3,
    idle_timeout: 20,
    max_lifetime: 60 * 5,
    connect_timeout: 10,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__pgClient = queryClient;
}

export const db = drizzle(queryClient, { schema });
export { schema };
