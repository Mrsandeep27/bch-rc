// ==========================================================================
// AUTHENTICATION STRESS TEST -- 1000 login attempts + dashboard hits.
//
// IMPORTANT: /api/admin/signin is rate-limited to 5/email + 20/IP per 15 min,
// and /api/cod/login to 20/IP per 15 min. A load generator has ONE source IP,
// so the overwhelming majority of attempts SHOULD return 429. That is the rate
// limiter WORKING. This test therefore asserts the failure modes the spec
// actually cares about:
//
//   - no 500s                  (signin_5xx_FAILURE == 0)
//   - no infinite loading      (every response < 10s)
//   - no redirect loops        (no unresolved 3xx)
//   - no "Connection closed"   (no 503 / connection errors)
//   - rate limiter engages     (429s observed, not 5xx)
//
//   $env:STAGE="4"; k6 run k6/auth-stress.js
// ==========================================================================
import http from "k6/http";
import { check, sleep } from "k6";
import { Counter, Trend } from "k6/metrics";
import { randomString } from "https://jslib.k6.io/k6-utils/1.4.0/index.js";
import { BASE_URL, buildStages } from "./lib/shared.js";

const signinAttempts = new Counter("signin_attempts");
const signin429 = new Counter("signin_429_rate_limited");
const signin401 = new Counter("signin_401_invalid");
const signin5xx = new Counter("signin_5xx_FAILURE");
const connClosed = new Counter("connection_closed_FAILURE");
const redirectLoops = new Counter("redirect_loop_FAILURE");
const authLatency = new Trend("auth_latency", true);

export const options = {
  scenarios: {
    // 1000 login attempts: iterations across a VU ramp, capped by time.
    logins: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: buildStages(),
      gracefulRampDown: "30s",
      exec: "loginAttempt",
    },
    // Steady stream of admin dashboard + COD console requests (unauthenticated
    // -> must cleanly redirect/401, never hang or 500).
    dashboard: {
      executor: "constant-vus",
      vus: 20,
      duration: "10m",
      exec: "dashboardAccess",
    },
  },
  thresholds: {
    signin_5xx_FAILURE: ["count<1"],
    connection_closed_FAILURE: ["count<1"],
    redirect_loop_FAILURE: ["count<1"],
    auth_latency: ["p(99)<10000"], // no infinite loading
    http_req_failed: ["rate<0.01"],
  },
};

const ADMIN_EMAIL = __ENV.ADMIN_EMAIL || "loadtest@example.com";
const ADMIN_PASSWORD = __ENV.ADMIN_PASSWORD || "wrong-password-on-purpose";
const COD_USERNAME = __ENV.COD_USERNAME || "loadtest";
const COD_PASSWORD = __ENV.COD_PASSWORD || "wrong-password-on-purpose";

const expectAuth = http.expectedStatuses({ min: 200, max: 399 }, 400, 401, 429, 503);

function classify(res) {
  if (res.error && /connection|reset|closed|EOF|timeout/i.test(res.error)) {
    connClosed.add(1);
    return;
  }
  if (res.status >= 500) {
    if (res.status === 503) connClosed.add(1);
    else signin5xx.add(1);
  } else if (res.status === 429) signin429.add(1);
  else if (res.status === 401 || res.status === 403) signin401.add(1);
}

export function loginAttempt() {
  // Vary email so we exercise BOTH the per-email (5) and per-IP (20) limiters,
  // not just one. ~1 in 4 reuse the configured email.
  const email = Math.random() < 0.25 ? ADMIN_EMAIL : `lt-${randomString(8)}@example.com`;

  const res = http.post(
    `${BASE_URL}/api/admin/signin`,
    JSON.stringify({ email, password: ADMIN_PASSWORD }),
    {
      headers: { "Content-Type": "application/json" },
      tags: { name: "admin_signin" },
      responseCallback: expectAuth,
    },
  );
  signinAttempts.add(1);
  authLatency.add(res.timings.duration);
  classify(res);
  check(res, {
    "no 5xx (except 503 pool)": (r) => r.status < 500 || r.status === 503,
    "responded < 10s (no infinite load)": (r) => r.timings.duration < 10000,
    "is 401 or 429 (expected)": (r) => r.status === 401 || r.status === 429 || r.status === 200,
  });

  // Also poke the COD console login (separate IP limiter).
  if (Math.random() < 0.3) {
    const cod = http.post(
      `${BASE_URL}/api/cod/login`,
      JSON.stringify({ username: COD_USERNAME, password: COD_PASSWORD }),
      {
        headers: { "Content-Type": "application/json" },
        tags: { name: "cod_login" },
        responseCallback: expectAuth,
      },
    );
    authLatency.add(cod.timings.duration);
    classify(cod);
  }

  sleep(Math.random() * 1.5);
}

// Unauthenticated dashboard access must NOT 500, hang, or redirect-loop. The
// admin (authed) layout redirects to /admin/login; /cod redirects to /cod/login.
export function dashboardAccess() {
  const paths = ["/admin", "/admin/orders", "/admin/inventory", "/cod"];
  for (let i = 0; i < paths.length; i++) {
    const path = paths[i];
    const res = http.get(`${BASE_URL}${path}`, {
      tags: { name: `dash_${path}` },
      redirects: 5, // follow up to 5; a loop would exhaust and surface
      responseCallback: http.expectedStatuses({ min: 200, max: 399 }, 401, 403),
    });
    authLatency.add(res.timings.duration);
    // A redirect loop manifests as max-redirects exhaustion (k6 stops at the
    // limit and reports the last 3xx) or a 3xx that never resolves to 200/401.
    const finalStatus = res.status;
    if (finalStatus >= 300 && finalStatus < 400) redirectLoops.add(1);
    if (finalStatus >= 500) signin5xx.add(1);
    check(res, {
      "dashboard no 5xx": (r) => r.status < 500,
      "dashboard resolved (200/401/redirected-to-login)": (r) =>
        r.status === 200 || r.status === 401 || r.status === 403 ||
        (r.url && /login/.test(r.url)),
      "dashboard < 10s": (r) => r.timings.duration < 10000,
    });
  }
  sleep(1);
}