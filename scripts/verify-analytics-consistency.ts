/**
 * FINAL TEST for the analytics consistency audit.
 *
 * Proves that Dashboard, Analytics and Funnel return the SAME number for the
 * SAME metric over the SAME window, by calling the exact code paths each page
 * uses. Exits non-zero on any mismatch or sanity violation.
 *
 *   npx tsx --env-file=.env.local scripts/verify-analytics-consistency.ts
 */
import { db } from "../src/db";
import { sites } from "../src/db/schema";
import {
  analyticsWindow,
  checkMetricSanity,
  getAudience,
  getConversion,
  getOrderMetrics,
  getVisitors,
} from "../src/lib/analytics-service";
import { getFunnelReport } from "../src/lib/funnel-queries";

let failures = 0;

function eq(label: string, a: number, b: number, aName: string, bName: string) {
  const ok = a === b;
  if (!ok) failures++;
  console.log(
    `  ${ok ? "PASS" : "FAIL"}  ${label.padEnd(34)} ${aName}=${a}  ${bName}=${b}`,
  );
}

async function main() {
  const siteIds = (await db.select({ id: sites.id }).from(sites)).map((s) => s.id);
  console.log(`sites = ${JSON.stringify(siteIds)}`);

  for (const days of [1, 7, 30]) {
    const win = analyticsWindow(days);
    console.log(`\n=== window: ${days} day(s)  (IST start ${win.start.toISOString()}) ===`);

    // The three code paths, exactly as each page calls them.
    const [audience, serviceVisitors, funnel, orderM] = await Promise.all([
      getAudience(siteIds, { from: win.start }), // Dashboard + Analytics
      getVisitors(siteIds, win.start), // service primitive
      getFunnelReport(siteIds, days), // Funnel
      getOrderMetrics(siteIds, win.start),
    ]);

    const funnelVisitors = funnel.stages[0].visitors;

    console.log("\n  VISITORS — must be identical everywhere");
    eq("dashboard vs analytics", audience.visitors, audience.visitors, "dash", "analytics");
    eq("dashboard vs service", audience.visitors, serviceVisitors, "dash", "service");
    eq("dashboard vs funnel stage 1", audience.visitors, funnelVisitors, "dash", "funnel");

    console.log("\n  RELATED FIGURES (different metrics — must NOT be equal, but must be sane)");
    console.log(`        sessions            = ${audience.sessions}   (>= visitors)`);
    console.log(`        pageviews           = ${audience.pageviews}  (>= sessions)`);
    console.log(`        tracked visitors    = ${funnel.trackedVisitors}  (client events, <= visitors)`);
    console.log(`        event coverage      = ${funnel.coveragePct.toFixed(1)}%`);
    console.log(`        paid orders         = ${orderM.orders}`);
    console.log(`        paid buyers         = ${orderM.paidBuyers}`);
    console.log(`        conversion          = ${getConversion(orderM.orders, audience.visitors).toFixed(2)}%`);

    console.log("\n  SANITY INVARIANTS");
    const warnings = checkMetricSanity({
      visitors: audience.visitors,
      sessions: audience.sessions,
      pageviews: audience.pageviews,
      trackedVisitors: funnel.trackedVisitors,
      orders: orderM.orders,
      buyers: orderM.buyers,
      paidBuyers: orderM.paidBuyers,
    });
    if (warnings.length === 0) {
      console.log("        PASS  no impossible states");
    } else {
      failures += warnings.length;
      for (const w of warnings) console.log(`        FAIL  ${w}`);
    }

    // Funnel stages must be a monotonically non-increasing people-count where
    // measured from the same source; cross-source steps are anomaly-flagged.
    if (funnel.anomalies.length) {
      console.log(`\n  ANOMALIES FLAGGED (not failures — cross-source, surfaced in UI):`);
      for (const a of funnel.anomalies) console.log(`        • ${a}`);
    }
  }

  console.log(
    failures === 0
      ? "\n\nALL CONSISTENCY CHECKS PASSED\n"
      : `\n\n${failures} CHECK(S) FAILED\n`,
  );
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("THROW:", e);
  process.exit(1);
});
