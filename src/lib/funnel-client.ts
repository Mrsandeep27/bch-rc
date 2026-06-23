/**
 * Client-side funnel tracker. Buffers user actions and flushes them to
 * /api/track/event in small batches (fetch keepalive), plus a guaranteed
 * sendBeacon flush when the tab is hidden/closed so we never lose the last
 * events of a session (the most important ones — where they dropped off).
 *
 * First-party, no PII, business-essential → fires for EVERY visitor with no
 * consent gate, exactly like the server-side session tracking. This is the
 * data Syed needs: of N visitors, how many reach each step and where they stop.
 */

import type { FunnelEventType } from "@/lib/funnel-events";

type Buffered = {
  type: FunnelEventType;
  path: string;
  metadata: Record<string, unknown>;
  orderId?: string | null;
};

const ENDPOINT = "/api/track/event";
const FLUSH_DEBOUNCE_MS = 1200;

const buffer: Buffered[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function send(useBeacon: boolean) {
  if (buffer.length === 0) return;
  const events = buffer.splice(0, buffer.length);
  const payload = JSON.stringify({ events });
  try {
    if (useBeacon && typeof navigator !== "undefined" && navigator.sendBeacon) {
      navigator.sendBeacon(ENDPOINT, new Blob([payload], { type: "application/json" }));
      return;
    }
    void fetch(ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: payload,
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Telemetry must never throw into the UI.
  }
}

function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    send(false);
  }, FLUSH_DEBOUNCE_MS);
}

/**
 * Record a funnel event. `immediate: true` flushes right away (use for events
 * that may be followed by a navigation/redirect — order_submitted, payment_*,
 * purchase — so they aren't lost in the buffer).
 */
export function trackFunnel(
  type: FunnelEventType,
  metadata: Record<string, unknown> = {},
  opts?: { path?: string; orderId?: string | null; immediate?: boolean },
): void {
  if (typeof window === "undefined") return;
  buffer.push({
    type,
    path: opts?.path ?? window.location.pathname,
    metadata,
    orderId: opts?.orderId ?? null,
  });
  if (opts?.immediate) {
    if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }
    send(false);
  } else {
    scheduleFlush();
  }
}

// Guaranteed delivery when the visitor leaves — captures the final (drop-off)
// event of the session. Registered once per client bundle.
if (typeof window !== "undefined") {
  const flushNow = () => send(true);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushNow();
  });
  window.addEventListener("pagehide", flushNow);
}
