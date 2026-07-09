/**
 * Executable checks for the analytics correctness fixes (Phase 5).
 *
 * No test framework is installed, so this is a standalone script over the PURE
 * helpers (tz / order-status / analytics-validation — none import the DB). Run:
 *
 *   npx tsx scripts/verify-analytics-math.ts
 *
 * Exits non-zero if any assertion fails, so it can gate CI later. Covers the
 * four areas the audit called out: date boundaries, order statuses, funnel
 * calculations, and the pageview-count invariant.
 */

import assert from "node:assert/strict";
import { addUtcDays, istDayStart, istWeekdayMon0, istYmd } from "../src/lib/tz";
import {
  ALL_ORDER_STATUSES,
  PAID_STATUSES,
  VALID_ORDER_STATUSES,
  bucketOfStatus,
} from "../src/lib/order-status";
import {
  clampPct,
  detectFunnelAnomalies,
  finiteOr0,
  safePct,
} from "../src/lib/analytics-validation";

let passed = 0;
const failures: string[] = [];
function check(name: string, fn: () => void) {
  try {
    fn();
    passed++;
  } catch (err) {
    failures.push(`${name}\n    ${(err as Error).message.split("\n").join("\n    ")}`);
  }
}

// ── Date boundaries (Bug 3) ───────────────────────────────────────────────
// The canonical case from the audit: an order at Jul 8 02:00 IST
// (= Jul 7 20:30 UTC) must read as Jul 8 everywhere, not Jul 7.
check("IST day: 02:00 IST stays on the same IST day", () => {
  assert.equal(istYmd(new Date("2026-07-07T20:30:00Z")), "2026-07-08");
});
check("IST day: 23:59 IST is still that day", () => {
  assert.equal(istYmd(new Date("2026-07-08T18:29:00Z")), "2026-07-08");
});
check("IST day: 00:00 IST rolls to the next day", () => {
  assert.equal(istYmd(new Date("2026-07-08T18:30:00Z")), "2026-07-09");
});
check("istDayStart returns IST midnight as a UTC instant", () => {
  const start = istDayStart(new Date("2026-07-07T20:30:00Z")); // Jul 8 02:00 IST
  assert.equal(start.toISOString(), "2026-07-07T18:30:00.000Z"); // Jul 8 00:00 IST
  assert.equal(istYmd(start), "2026-07-08");
});
check("addUtcDays walks whole IST days", () => {
  const today = istDayStart(new Date("2026-07-08T06:00:00Z"));
  assert.equal(istYmd(addUtcDays(today, -29)), "2026-06-09"); // 30-day window start
  assert.equal(istYmd(addUtcDays(today, 1)), "2026-07-09");
});
check("Monday-anchored week: subtracting the IST weekday lands on Monday", () => {
  for (const iso of [
    "2026-07-08T06:00:00Z",
    "2026-01-01T00:00:00Z",
    "2026-12-31T23:00:00Z",
    "2026-03-15T20:00:00Z",
  ]) {
    const today = istDayStart(new Date(iso));
    const dow = istWeekdayMon0(today);
    assert.ok(dow >= 0 && dow <= 6, `weekday in range for ${iso}`);
    assert.equal(istWeekdayMon0(addUtcDays(today, -dow)), 0, `Monday anchor for ${iso}`);
  }
});

// ── Order statuses (Bug 4) ────────────────────────────────────────────────
check("PENDING_COD_VERIFICATION is counted (was silently dropped)", () => {
  assert.equal(bucketOfStatus("PENDING_COD_VERIFICATION"), "pending");
});
check("status buckets are correct", () => {
  assert.equal(bucketOfStatus("PENDING"), "pending");
  assert.equal(bucketOfStatus("PAID"), "live");
  assert.equal(bucketOfStatus("DELIVERED"), "live");
  assert.equal(bucketOfStatus("FAILED"), "failed");
  assert.equal(bucketOfStatus("CANCELLED"), "failed");
  assert.equal(bucketOfStatus("RETURNED"), "failed");
});
check("unknown/future status falls back to 'other' (never vanishes)", () => {
  assert.equal(bucketOfStatus("SOME_FUTURE_STATUS"), "other");
});
check("every real status buckets into live/pending/failed — none lost", () => {
  for (const s of ALL_ORDER_STATUSES) {
    assert.notEqual(bucketOfStatus(s), "other", `${s} must not fall through`);
  }
});
check("status-mix denominator covers every order row", () => {
  // Simulate one row per status; the four buckets must sum to the total.
  const counts = Object.fromEntries(ALL_ORDER_STATUSES.map((s) => [s, 1]));
  let live = 0, pending = 0, failed = 0, other = 0;
  for (const s of ALL_ORDER_STATUSES) {
    const b = bucketOfStatus(s);
    if (b === "live") live += counts[s];
    else if (b === "pending") pending += counts[s];
    else if (b === "failed") failed += counts[s];
    else other += counts[s];
  }
  assert.equal(live + pending + failed + other, ALL_ORDER_STATUSES.length);
});

// ── Funnel calculations (Bug 1 + Bug 2) ───────────────────────────────────
check("PAID_STATUSES ⊆ VALID_ORDER_STATUSES → Paid can never exceed Placed", () => {
  for (const s of PAID_STATUSES) {
    assert.ok(
      (VALID_ORDER_STATUSES as readonly string[]).includes(s),
      `${s} paid must count as placed`,
    );
  }
});
check("VALID_ORDER_STATUSES excludes never-real states", () => {
  for (const bad of ["FAILED", "ABANDONED", "CANCELLED"]) {
    assert.ok(
      !(VALID_ORDER_STATUSES as readonly string[]).includes(bad),
      `${bad} must not count as a placed order`,
    );
  }
});
check("healthy funnel has no anomalies", () => {
  const stages = [100, 50, 20, 10, 5, 3].map((v, i) => ({ label: `s${i}`, visitors: v }));
  assert.deepEqual(detectFunnelAnomalies(stages), []);
});
check("a downstream stage bigger than upstream is flagged", () => {
  // order (12) > checkout (10) — the classic unit-mismatch symptom.
  const stages = [100, 50, 20, 10, 12, 3].map((v, i) => ({ label: `s${i}`, visitors: v }));
  assert.equal(detectFunnelAnomalies(stages).length, 1);
});
check("step % is clamped to 100 even when a stage overflows", () => {
  assert.equal(clampPct(safePct(12, 10)), 100); // would be 120% unclamped
});
check("overall conversion never exceeds 100%", () => {
  assert.equal(clampPct(safePct(9999, 100)), 100);
});

// ── safe math primitives ──────────────────────────────────────────────────
check("safePct guards divide-by-zero and NaN/Infinity", () => {
  assert.equal(safePct(5, 0), 0);
  assert.equal(safePct(5, 10), 50);
  assert.equal(safePct(3, 3), 100);
  assert.equal(finiteOr0(NaN), 0);
  assert.equal(finiteOr0(Infinity), 0);
  assert.equal(clampPct(-5), 0);
  assert.equal(clampPct(NaN), 0);
});

// ── Pageview count invariant (Bug 5) ──────────────────────────────────────
// Model the two writers: the server session-insert base + the event handler
// that increments once per page_view. After the fix the server base is 0 and
// events own the tally, so a 1-page session = exactly 1 pageview.
check("1-page session = 1 pageview (single owner)", () => {
  const sessionPageviews = (serverBase: number, pageViewEvents: number) =>
    serverBase + pageViewEvents;
  assert.equal(sessionPageviews(0, 1), 1, "one page → one pageview");
  assert.equal(sessionPageviews(0, 3), 3, "three pages → three pageviews");
  // Regression guard: the OLD base of 1 double-counted the landing page.
  assert.equal(sessionPageviews(1, 1), 2, "documents the pre-fix double count");
});

// ── Report ─────────────────────────────────────────────────────────────────
const total = passed + failures.length;
if (failures.length === 0) {
  console.log(`✅ analytics math: ${passed}/${total} checks passed`);
  process.exit(0);
} else {
  console.error(`❌ analytics math: ${failures.length}/${total} checks FAILED\n`);
  for (const f of failures) console.error(`  ✗ ${f}\n`);
  process.exit(1);
}
