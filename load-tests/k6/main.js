// ==========================================================================
// PRIMARY mixed-traffic load test.
// Simulates the 70/20/8/2 customer mix across staged VU profiles
// (100 / 250 / 500 / 1000) with ramp-up 5m -> sustain 15m -> ramp-down 5m.
//
//   $env:BASE_URL="https://staging.pocketrc.example"; $env:STAGE="4"; k6 run k6/main.js
//   $env:STAGE="4"; $env:ENABLE_WRITES="true"; k6 run k6/main.js   # staging only
//   $env:STAGE="full"; k6 run k6/main.js                            # step soak
// ==========================================================================
import { sleep } from "k6";
import { textSummary } from "https://jslib.k6.io/k6-summary/0.1.0/index.js";
import {
  buildStages,
  pickJourney,
  browseJourney,
  cartJourney,
  checkoutJourney,
  adminJourney,
  SUCCESS_THRESHOLDS,
  BASE_URL,
  ENABLE_WRITES,
} from "./lib/shared.js";

export const options = {
  scenarios: {
    customers: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: buildStages(),
      gracefulRampDown: "30s",
    },
  },
  thresholds: {
    ...SUCCESS_THRESHOLDS,
    // Per-journey latency budgets (browsing should be snappiest).
    "journey_duration{journey:browse}": ["p(95)<3000"],
    "journey_duration{journey:checkout}": ["p(95)<8000"],
    // Page/route-level visibility.
    "http_req_duration{name:homepage}": ["p(95)<2000"],
    "http_req_duration{name:pdp}": ["p(95)<2000"],
    "http_req_duration{name:stock}": ["p(95)<1000"],
    "http_req_duration{name:order_cod}": ["p(95)<3000"],
  },
  // Keep noise down; we record our own per-journey trends.
  discardResponseBodies: true,
};

export function setup() {
  // eslint-disable-next-line no-console
  console.log(
    `\nLoad test against ${BASE_URL}\n  writes=${ENABLE_WRITES}  stages=${JSON.stringify(buildStages())}\n`,
  );
  return { startedAt: new Date().toISOString() };
}

export default function () {
  const journey = pickJourney();
  switch (journey) {
    case "browse":
      browseJourney();
      break;
    case "cart":
      cartJourney();
      break;
    case "checkout":
      checkoutJourney();
      break;
    case "admin":
      adminJourney();
      break;
  }
  // Think-time between sessions so a VU models a returning person, not a bot.
  sleep(Math.random() * 3 + 1);
}

export function handleSummary(data) {
  return {
    stdout: textSummary(data, { indent: " ", enableColors: true }),
    "summary.json": JSON.stringify(data, null, 2),
  };
}