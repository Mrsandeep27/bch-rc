// ==========================================================================
// Shared config, data, custom metrics, and journey functions for the k6 suite.
// Imported by main.js, auth-stress.js, and db-stress.js so the journeys and
// success-criteria thresholds stay identical across scripts.
// ==========================================================================
import http from "k6/http";
import { check, sleep } from "k6";
import { Trend, Rate, Counter } from "k6/metrics";
import { randomString, randomIntBetween } from "https://jslib.k6.io/k6-utils/1.4.0/index.js";

// -- Environment -----------------------------------------------------------
export const BASE_URL = (__ENV.BASE_URL || "http://localhost:3000").replace(/\/+$/, "");
export const ENABLE_WRITES = (__ENV.ENABLE_WRITES || "false").toLowerCase() === "true";
export const PREPAID_RATIO = parseFloat(__ENV.PREPAID_RATIO || "0.2");
export const TEST_SKU = __ENV.TEST_SKU || "qa-1rs";
export const SERVICEABLE_PINCODES = (
  __ENV.SERVICEABLE_PINCODES || "560001,400001,110001,600001,500001"
).split(",").map((s) => s.trim());

// Real, visible storefront slugs (from src/lib/products.ts). qa-1rs is hidden,
// so it is browsed only via the write path, never the public grid journey.
export const PRODUCT_SLUGS = [
  "pocket-bmw",
  "pocket-porsche",
  "pocket-thar",
  "pocket-monster",
  "pocket-f1-classic",
];

// Coupon codes to preview-validate. Unknown codes return ok:false (still 200) --
// that's a valid response, so this exercises the path regardless of config.
export const COUPON_CODES = ["WELCOME10", "FLAT100", "FREESHIP", "INVALIDXYZ"];

// -- Custom metrics --------------------------------------------------------
// Per-journey latency so you can see WHICH journey is slow, not just the global.
export const journeyDuration = new Trend("journey_duration", true);
export const browseDuration = new Trend("browse_duration", true);
export const cartDuration = new Trend("cart_duration", true);
export const checkoutDuration = new Trend("checkout_duration", true);
export const adminDuration = new Trend("admin_duration", true);

// "Real" errors only -- excludes intended 429/401/409 business responses.
export const realErrors = new Rate("real_errors");
// DB pool-exhaustion signal: 503 from order-create / dynamic routes.
export const dbUnavailable = new Counter("db_unavailable_503");
// Auth outcomes split out so 429 (rate-limit, healthy) != 5xx (failure).
export const authRateLimited = new Counter("auth_rate_limited_429");
export const authServerError = new Counter("auth_server_error_5xx");
// Stock-sold-out business responses (expected if qa-1rs runs dry on staging).
export const soldOut409 = new Counter("sold_out_409");

// -- Shared thresholds = the success criteria ------------------------------
// http_req_failed only counts UNEXPECTED statuses because we pass per-request
// responseCallbacks below that whitelist business statuses (401/409/429).
export const SUCCESS_THRESHOLDS = {
  http_req_duration: ["p(95)<2000", "p(99)<5000"],
  http_req_failed: ["rate<0.01"],
  real_errors: ["rate<0.01"],
  auth_server_error_5xx: ["count<1"],   // "no auth failures" (5xx/timeout)
  db_unavailable_503: ["count<1"],      // "no pool exhaustion / db crashes"
};

// k6 marks a response "failed" unless its status is in the expected set. We
// whitelist business statuses per request so the rate limiter and sold-out
// guard don't pollute the error budget.
const expect2xx3xx = http.expectedStatuses({ min: 200, max: 399 });
const expectAuth = http.expectedStatuses({ min: 200, max: 399 }, 400, 401, 429);
const expectOrder = http.expectedStatuses({ min: 200, max: 399 }, 400, 409, 422, 429);

// -- Stage builder ---------------------------------------------------------
const RAMP = parseInt(__ENV.RAMP_MINUTES || "5", 10);
const SUSTAIN = parseInt(__ENV.SUSTAIN_MINUTES || "15", 10);
const RAMPDOWN = parseInt(__ENV.RAMPDOWN_MINUTES || "5", 10);
const STAGE_PEAKS = { "1": 100, "2": 250, "3": 500, "4": 1000 };

// One stage = ramp-up -> sustain -> ramp-down.
function stageProfile(peak) {
  return [
    { duration: `${RAMP}m`, target: peak },
    { duration: `${SUSTAIN}m`, target: peak },
    { duration: `${RAMPDOWN}m`, target: 0 },
  ];
}

// Returns the k6 `stages` array based on STAGE / TARGET_VUS env.
export function buildStages() {
  const stage = (__ENV.STAGE || "1").toLowerCase();
  if (stage === "full") {
    // Step-load soak: 100 -> 250 -> 500 -> 1000, each ramp->sustain-> (no full
    // ramp-down between steps; one ramp-down at the very end).
    return [
      ...[100, 250, 500].flatMap((p) => [
        { duration: `${RAMP}m`, target: p },
        { duration: `${SUSTAIN}m`, target: p },
      ]),
      { duration: `${RAMP}m`, target: 1000 },
      { duration: `${SUSTAIN}m`, target: 1000 },
      { duration: `${RAMPDOWN}m`, target: 0 },
    ];
  }
  const peak = parseInt(__ENV.TARGET_VUS || STAGE_PEAKS[stage] || "100", 10);
  return stageProfile(peak);
}

// -- Helpers ---------------------------------------------------------------
export function pick(arr) {
  return arr[randomIntBetween(0, arr.length - 1)];
}

// Weighted journey selector matching the required 70/20/8/2 mix.
export function pickJourney() {
  const r = Math.random() * 100;
  if (r < 70) return "browse";
  if (r < 90) return "cart";     // 70..90 = 20%
  if (r < 98) return "checkout"; // 90..98 = 8%
  return "admin";                // 98..100 = 2%
}

function tag(journey, name) {
  return { tags: { journey, name } };
}

function recordReal(res, ok) {
  realErrors.add(!ok);
  if (res.status === 503) dbUnavailable.add(1);
}

// A throwaway-but-valid checkout address for the write path.
function makeAddress() {
  const phone = `9${randomIntBetween(100000000, 999999999)}`;
  return {
    fullName: `Load Test ${randomString(5)}`,
    phone: String(phone).slice(0, 10),
    email: `load+${randomString(8)}@example.com`,
    line1: `${randomIntBetween(1, 999)} Test Street`,
    line2: "",
    city: "Bengaluru",
    state: "Karnataka",
    pincode: pick(SERVICEABLE_PINCODES),
  };
}

// -- Journeys --------------------------------------------------------------

// 70% -- Homepage -> product grid -> PDP -> live stock.
export function browseJourney() {
  const t0 = Date.now();
  let ok = true;

  let res = http.get(`${BASE_URL}/`, { ...tag("browse", "homepage"), responseCallback: expect2xx3xx });
  ok = check(res, { "home 200": (r) => r.status === 200 }) && ok;
  recordReal(res, res.status < 400);
  sleep(randomIntBetween(1, 3));

  const slug = pick(PRODUCT_SLUGS);
  res = http.get(`${BASE_URL}/product/${slug}`, { ...tag("browse", "pdp"), responseCallback: expect2xx3xx });
  ok = check(res, { "pdp 200": (r) => r.status === 200 }) && ok;
  recordReal(res, res.status < 400);
  sleep(randomIntBetween(1, 4));

  res = http.get(`${BASE_URL}/api/stock?skuIds=${slug}`, { ...tag("browse", "stock"), responseCallback: expect2xx3xx });
  ok = check(res, { "stock 200": (r) => r.status === 200 }) && ok;
  recordReal(res, res.status < 400);

  browseDuration.add(Date.now() - t0);
  journeyDuration.add(Date.now() - t0, { journey: "browse" });
}

// 20% -- PDP -> stock refresh -> serviceability check (the calls an add-to-cart
// + cart-drawer open actually make; the cart itself is client-side state).
export function cartJourney() {
  const t0 = Date.now();
  let ok = true;
  const slug = pick(PRODUCT_SLUGS);

  let res = http.get(`${BASE_URL}/product/${slug}`, { ...tag("cart", "pdp"), responseCallback: expect2xx3xx });
  ok = check(res, { "pdp 200": (r) => r.status === 200 }) && ok;
  recordReal(res, res.status < 400);
  sleep(randomIntBetween(1, 3));

  res = http.get(`${BASE_URL}/api/stock?skuIds=${slug}`, { ...tag("cart", "stock"), responseCallback: expect2xx3xx });
  ok = check(res, { "stock 200": (r) => r.status === 200 }) && ok;
  recordReal(res, res.status < 400);

  const pincode = pick(SERVICEABLE_PINCODES);
  res = http.get(`${BASE_URL}/api/serviceability?pincode=${pincode}`, { ...tag("cart", "serviceability"), responseCallback: expect2xx3xx });
  ok = check(res, {
    "svc 200": (r) => r.status === 200,
    "svc serviceable": (r) => { try { return r.json("serviceable") === true; } catch { return false; } },
  }) && ok;
  recordReal(res, res.status < 400);

  cartDuration.add(Date.now() - t0);
  journeyDuration.add(Date.now() - t0, { journey: "cart" });
}

// 8% -- Checkout page -> serviceability -> coupon preview -> (optional) place order.
export function checkoutJourney() {
  const t0 = Date.now();
  let ok = true;

  let res = http.get(`${BASE_URL}/checkout`, { ...tag("checkout", "page"), responseCallback: expect2xx3xx });
  ok = check(res, { "checkout 200": (r) => r.status === 200 }) && ok;
  recordReal(res, res.status < 400);
  sleep(randomIntBetween(2, 5));

  const pincode = pick(SERVICEABLE_PINCODES);
  res = http.get(`${BASE_URL}/api/serviceability?pincode=${pincode}`, { ...tag("checkout", "serviceability"), responseCallback: expect2xx3xx });
  ok = check(res, { "svc 200": (r) => r.status === 200 }) && ok;
  recordReal(res, res.status < 400);

  res = http.get(
    `${BASE_URL}/api/coupons/validate?code=${pick(COUPON_CODES)}&siteId=prc&subtotalInr=1299&shippingInr=0`,
    { ...tag("checkout", "coupon"), responseCallback: expect2xx3xx },
  );
  // ok:false for an unknown code is still HTTP 200 -- only non-200 is an error.
  ok = check(res, { "coupon 200": (r) => r.status === 200 }) && ok;
  recordReal(res, res.status < 400);
  sleep(randomIntBetween(1, 3));

  if (ENABLE_WRITES) {
    placeOrder();
  }

  checkoutDuration.add(Date.now() - t0);
  journeyDuration.add(Date.now() - t0, { journey: "checkout" });
}

// The actual write. ~PREPAID_RATIO prepaid, rest COD. STAGING ONLY.
export function placeOrder() {
  const prepaid = Math.random() < PREPAID_RATIO;
  const address = makeAddress();
  if (prepaid) address.pincode = pick(SERVICEABLE_PINCODES);

  const body = {
    siteId: "prc",
    idempotencyKey: `lt-${Date.now()}-${randomString(20)}`,
    items: [{ skuId: TEST_SKU, variantSlug: null, qty: 1 }],
    address,
    paymentMethod: prepaid ? "UPI" : "COD",
  };

  const res = http.post(`${BASE_URL}/api/orders/create`, JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    ...tag("checkout", prepaid ? "order_prepaid" : "order_cod"),
    responseCallback: expectOrder,
  });

  if (res.status === 409) soldOut409.add(1);      // qa-1rs sold out -- business, not failure
  if (res.status === 503) dbUnavailable.add(1);   // pool exhaustion signal

  const ok = check(res, {
    "order accepted or business-rejected": (r) =>
      r.status === 200 || r.status === 400 || r.status === 409 || r.status === 422,
    "order not 5xx": (r) => r.status < 500,
  });
  // Only 5xx counts against the error budget; 409/422/400 are valid outcomes.
  realErrors.add(res.status >= 500);
  return ok;
}

// 2% -- Admin login page + a sign-in attempt. 401 (bad creds) and 429
// (rate-limited) are EXPECTED and healthy; only 5xx/timeout is a failure.
export function adminJourney() {
  const t0 = Date.now();

  let res = http.get(`${BASE_URL}/admin/login`, { ...tag("admin", "login_page"), responseCallback: expect2xx3xx });
  check(res, { "admin login page 200": (r) => r.status === 200 });
  recordReal(res, res.status < 400);
  sleep(randomIntBetween(1, 2));

  res = http.post(
    `${BASE_URL}/api/admin/signin`,
    JSON.stringify({
      email: __ENV.ADMIN_EMAIL || "loadtest@example.com",
      password: __ENV.ADMIN_PASSWORD || "wrong-password-on-purpose",
    }),
    { headers: { "Content-Type": "application/json" }, ...tag("admin", "signin"), responseCallback: expectAuth },
  );
  if (res.status === 429) authRateLimited.add(1);
  if (res.status >= 500) authServerError.add(1);
  check(res, {
    "signin no 5xx": (r) => r.status < 500,
    "signin no infinite-hang": (r) => r.timings.duration < 10000,
  });
  realErrors.add(res.status >= 500);

  adminDuration.add(Date.now() - t0);
  journeyDuration.add(Date.now() - t0, { journey: "admin" });
}