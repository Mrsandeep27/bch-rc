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

import { NextResponse } from "next/server";
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

/**
 * Best-effort client IP for rate-limit bucketing. Prefers `x-real-ip` — on
 * Vercel this is set by the platform to the actual connecting peer and is NOT
 * overridable by a client-supplied header, so it can't be spoofed to mint a
 * fresh bucket per request. We only fall back to the LEFTMOST `x-forwarded-for`
 * token (and finally "unknown") for non-Vercel/local environments where
 * `x-real-ip` may be absent.
 *
 * The previous per-route copies trusted `x-forwarded-for[0]` first, which a
 * caller can spoof (Vercel appends the real IP, so the leftmost value is
 * attacker-controlled). Centralising here fixes that uniformly.
 */
export function clientIp(req: Request): string {
  const real = req.headers.get("x-real-ip")?.trim();
  if (real) return real;
  const xff = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (xff) return xff;
  return "unknown";
}

export type RouteRateLimitOptions = {
  /** Scope label for logs, e.g. "coupons:validate". Also the default bucket. */
  scope: string;
  /** Max requests allowed per window for a single client IP. */
  limit: number;
  /** Window length in ms. Defaults to 60_000 (1 minute). */
  windowMs?: number;
  /** Optional bucket namespace override (defaults to `scope`). */
  bucket?: string;
  /**
   * When true, an over-limit caller gets a silent empty 204 instead of a 429
   * JSON body. Use for fire-and-forget telemetry endpoints whose contract is
   * "never surface an error to the page" (e.g. /api/track/*).
   */
  silent?: boolean;
};

/**
 * One-call per-IP rate-limit guard for route handlers. Returns a ready-to-send
 * response when the caller is over the limit, or `null` when the request is
 * allowed (so the handler proceeds).
 *
 *   export async function POST(req: Request) {
 *     const limited = rateLimit(req, { scope: "reviews:submit", limit: 10 });
 *     if (limited) return limited;
 *     ...
 *   }
 *
 * In-process fixed-window (see module header): a real per-instance speed bump
 * for floods/enumeration, not a distributed guarantee. Swap the backing
 * `hit()` for Redis/Upstash to make the limit global without touching callers.
 */
export function rateLimit(
  req: Request,
  opts: RouteRateLimitOptions,
): NextResponse | null {
  const windowMs = opts.windowMs ?? 60_000;
  const ip = clientIp(req);
  const result = checkLimits(opts.scope, Date.now(), [
    {
      key: `${opts.bucket ?? opts.scope}:ip:${ip}`,
      limit: opts.limit,
      windowMs,
      dimension: "ip",
    },
  ]);
  if (!result.blocked) return null;

  if (opts.silent) {
    return new NextResponse(null, { status: 204 });
  }
  return NextResponse.json(
    {
      ok: false,
      error: "Too many requests. Please slow down and try again shortly.",
    },
    { status: 429, headers: { "Retry-After": String(result.retryAfterSec) } },
  );
}
