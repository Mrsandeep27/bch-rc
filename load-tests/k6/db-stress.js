// ==========================================================================
// DATABASE / CONNECTION-POOL STRESS TEST.
//
// Purpose: drive enough concurrent DB-touching requests to surface the
// Supabase Supavisor pool ceiling and the failure modes in src/db/index.ts:
//   - pool exhaustion       -> 503 (db_unavailable_503)  <-- the key signal
//   - "Connection closed"   -> caught + retried once by withDbRetry; if the
//                              retry also fails it becomes DatabaseUnavailableError -> 503
//   - slow queries / locks  -> tail latency on order-create (p99)
//   - deadlocks/table locks -> 500 on concurrent stock decrements of one SKU
//
// This test concentrates fire on the heaviest DB paths:
//   * GET  /api/stock              (read; getStockMap)
//   * GET  /api/health/inventory   (read; full inventory aggregate)
//   * GET  /api/serviceability     (cheap, deterministic -- control baseline)
//   * POST /api/orders/create      (write; multi-statement TXN + stock UPDATE)
//
// To maximise lock contention, when ENABLE_WRITES=true orders hammer the SAME
// sku/variant so the atomic `stock >= qty` UPDATE serialises -- this is exactly
// the row-lock path you want to observe under load.
//
//   $env:ENABLE_WRITES="true"; $env:STAGE="4"; k6 run k6/db-stress.js
// ==========================================================================
import http from "k6/http";
import { check } from "k6";
import { Counter, Trend } from "k6/metrics";
import { randomString } from "https://jslib.k6.io/k6-utils/1.4.0/index.js";
import {
  BASE_URL,
  ENABLE_WRITES,
  TEST_SKU,
  SERVICEABLE_PINCODES,
  PREPAID_RATIO,
  buildStages,
  pick,
} from "./lib/shared.js";

const pool503 = new Counter("db_unavailable_503");
const conflict409 = new Counter("stock_conflict_409");
const serverError5xx = new Counter("db_server_error_5xx");
const writeLatency = new Trend("order_create_latency", true);
const stockLatency = new Trend("stock_read_latency", true);
const healthLatency = new Trend("inventory_health_latency", true);

export const options = {
  scenarios: {
    db_pressure: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: buildStages(),
      gracefulRampDown: "30s",
    },
  },
  thresholds: {
    db_unavailable_503: ["count<1"],   // pool exhaustion / db crash
    db_server_error_5xx: ["count<1"],  // deadlocks, unhandled errors
    order_create_latency: ["p(95)<3000", "p(99)<5000"],
    stock_read_latency: ["p(95)<1000"],
    inventory_health_latency: ["p(95)<2000"],
    http_req_failed: ["rate<0.01"],
  },
};

const expectRead = http.expectedStatuses({ min: 200, max: 399 }, 503);
const expectOrder = http.expectedStatuses({ min: 200, max: 399 }, 400, 409, 422, 429, 503);

function note(res) {
  if (res.status === 503) pool503.add(1);
  else if (res.status >= 500) serverError5xx.add(1);
}

export default function () {
  // -- Read pressure (every iteration) -------------------------------------
  let res = http.get(`${BASE_URL}/api/stock`, {
    tags: { name: "stock_all" },
    responseCallback: expectRead,
  });
  stockLatency.add(res.timings.duration);
  note(res);
  check(res, { "stock < 1s": (r) => r.timings.duration < 1000, "stock no 5xx except 503": (r) => r.status < 500 || r.status === 503 });

  // Inventory health = heavier aggregate; hit it ~1 in 5 iterations.
  if (Math.random() < 0.2) {
    res = http.get(`${BASE_URL}/api/health/inventory`, {
      tags: { name: "inventory_health" },
      responseCallback: http.expectedStatuses(200, 503),
    });
    healthLatency.add(res.timings.duration);
    note(res);
  }

  // -- Write pressure (lock contention) ------------------------------------
  if (ENABLE_WRITES) {
    const prepaid = Math.random() < PREPAID_RATIO;
    const phone = `9${Math.floor(100000000 + Math.random() * 899999999)}`.slice(0, 10);
    const body = {
      siteId: "prc",
      idempotencyKey: `db-${Date.now()}-${randomString(20)}`,
      items: [{ skuId: TEST_SKU, variantSlug: null, qty: 1 }],
      address: {
        fullName: `DB Stress ${randomString(4)}`,
        phone,
        email: `db+${randomString(8)}@example.com`,
        line1: "1 Lock Contention Rd",
        city: "Bengaluru",
        state: "Karnataka",
        pincode: pick(SERVICEABLE_PINCODES),
      },
      paymentMethod: prepaid ? "UPI" : "COD",
    };
    res = http.post(`${BASE_URL}/api/orders/create`, JSON.stringify(body), {
      headers: { "Content-Type": "application/json" },
      tags: { name: "order_create" },
      responseCallback: expectOrder,
    });
    writeLatency.add(res.timings.duration);
    if (res.status === 409) conflict409.add(1); // serialised stock UPDATE rejected -- expected when SKU runs low
    note(res);
    check(res, {
      "order no 5xx except 503": (r) => r.status < 500 || r.status === 503,
      "order < 5s": (r) => r.timings.duration < 5000,
    });
  }
}

export function handleSummary(data) {
  const m = data.metrics;
  const get = (k) => (m[k] ? m[k].values : {});
  // eslint-disable-next-line no-console
  console.log(
    "\n-- DB stress verdict --------------------------------\n" +
      `  pool-exhaustion 503s : ${get("db_unavailable_503").count || 0}\n` +
      `  other 5xx            : ${get("db_server_error_5xx").count || 0}\n` +
      `  stock conflict 409s  : ${get("stock_conflict_409").count || 0}\n` +
      `  order p95 / p99      : ${Math.round(get("order_create_latency")["p(95)"] || 0)}ms / ${Math.round(get("order_create_latency")["p(99)"] || 0)}ms\n`,
  );
  return { "db-stress-summary.json": JSON.stringify(data, null, 2) };
}