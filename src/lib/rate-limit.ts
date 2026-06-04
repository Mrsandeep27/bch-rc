/**
 * Minimal in-process fixed-window rate limiter.
 *
 * No external infra (Upstash / Vercel KV / Redis) is provisioned for this
 * project, so this is a self-contained server-side limiter. The counter map
 * is cached on globalThis so it survives module re-evaluation (dev HMR) and
 * is shared across all requests handled by the SAME serverless instance.
 *
 * Limitation (documented, not hidden): on Vercel each Lambda instance has its
 * own map, so the effective global limit is (configured limit × concurrent
 * instances). This is a real brute-force/credential-stuffing speed bump for
 * the common single-warm-instance case, not a distributed guarantee. When a
 * hard global limit is required, swap `hit()` for an Upstash/Redis INCR with
 * the same signature — every call site already treats this as a black box.
 */

import { logWarn } from "./logger";

export type RateLimitResult = {
  allowed: boolean;
  /** Remaining attempts in the current window (0 when blocked). */
  remaining: number;
  /** Seconds until the window resets — use for the Retry-After header. */
  retryAfterSec: number;
};

type Bucket = { count: number; resetAt: number };

const globalForRl = globalThis as unknown as {
  __rlStore?: Map<string, Bucket>;
  __rlLastSweep?: number;
};

const store: Map<string, Bucket> = globalForRl.__rlStore ?? new Map();
globalForRl.__rlStore = store;

// Opportunistic cleanup so a stream of unique keys (e.g. spoofed IPs) can't
// grow the map without bound. Sweep at most once per SWEEP_INTERVAL_MS.
const SWEEP_INTERVAL_MS = 60_000;

function sweep(now: number): void {
  const last = globalForRl.__rlLastSweep ?? 0;
  if (now - last < SWEEP_INTERVAL_MS) return;
  globalForRl.__rlLastSweep = now;
  for (const [key, bucket] of store) {
    if (bucket.resetAt <= now) store.delete(key);
  }
}

/**
 * Record one hit against `key` and report whether it is allowed.
 *
 * Fixed window: the first hit opens a window of `windowMs`; subsequent hits
 * increment until `limit` is reached, after which they are blocked until the
 * window expires. Blocked hits do NOT extend the window (no penalty stacking).
 *
 * `now` is injected so callers (and tests) control the clock.
 */
export function hit(
  key: string,
  limit: number,
  windowMs: number,
  now: number,
): RateLimitResult {
  sweep(now);

  const bucket = store.get(key);

  if (!bucket || bucket.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return {
      allowed: true,
      remaining: limit - 1,
      retryAfterSec: Math.ceil(windowMs / 1000),
    };
  }

  const retryAfterSec = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));

  if (bucket.count >= limit) {
    return { allowed: false, remaining: 0, retryAfterSec };
  }

  bucket.count += 1;
  return { allowed: true, remaining: limit - bucket.count, retryAfterSec };
}

/**
 * Convenience wrapper that checks several named limits and returns the first
 * one that blocks (so the caller can log which dimension tripped). All limits
 * are recorded (hit) regardless, which is the intended fixed-window behaviour.
 */
export function checkLimits(
  scope: string,
  now: number,
  limits: Array<{ key: string; limit: number; windowMs: number; dimension: string }>,
): { blocked: false } | { blocked: true; dimension: string; retryAfterSec: number } {
  let blocked: { dimension: string; retryAfterSec: number } | null = null;
  for (const l of limits) {
    const res = hit(l.key, l.limit, l.windowMs, now);
    if (!res.allowed && !blocked) {
      blocked = { dimension: l.dimension, retryAfterSec: res.retryAfterSec };
    }
  }
  if (blocked) {
    logWarn(scope, "rate limit exceeded", {
      dimension: blocked.dimension,
      retryAfterSec: blocked.retryAfterSec,
    });
    return { blocked: true, ...blocked };
  }
  return { blocked: false };
}
