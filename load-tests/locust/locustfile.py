"""
Locust mirror of the k6/Artillery suite -- same customer journeys, same
70/20/8/2 traffic mix, same staged ramp/sustain/ramp-down profile.

Run (headless, stage 4 = 1000 users, CSV out):
    locust -f locustfile.py --headless --host $BASE_URL --csv results/stage4

Run (web UI -- live percentiles at http://localhost:8089):
    locust -f locustfile.py --host $BASE_URL

The bundled StagedShape drives the user count automatically (ignores -u/-r) so
the run reproduces ramp-up 5m -> sustain 15m -> ramp-down 5m for the stage set
via the STAGE env var (1/2/3/4/full).

Reads the SAME .env as k6 and Artillery (BASE_URL, ENABLE_WRITES, etc.).
401/429/409/422 are treated as EXPECTED (rate-limit / business) responses and
are NOT counted as failures -- matching the spec's success criteria.
"""
import os
import random
import string
import time

from locust import HttpUser, task, between, events
from locust import LoadTestShape

try:
    from dotenv import load_dotenv
    # Load ../.env (repo-level load-tests/.env) then ./.env if present.
    load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))
    load_dotenv()
except ImportError:
    pass


# -- Config ----------------------------------------------------------------
def env(name, default):
    v = os.environ.get(name)
    return default if v is None or v == "" else v


ENABLE_WRITES = env("ENABLE_WRITES", "false").lower() == "true"
PREPAID_RATIO = float(env("PREPAID_RATIO", "0.2"))
TEST_SKU = env("TEST_SKU", "qa-1rs")
SERVICEABLE_PINCODES = [p.strip() for p in env(
    "SERVICEABLE_PINCODES", "560001,400001,110001,600001,500001").split(",")]
ADMIN_EMAIL = env("ADMIN_EMAIL", "loadtest@example.com")
ADMIN_PASSWORD = env("ADMIN_PASSWORD", "wrong-password-on-purpose")

PRODUCT_SLUGS = ["pocket-bmw", "pocket-porsche", "pocket-thar",
                 "pocket-monster", "pocket-f1-classic"]
COUPON_CODES = ["WELCOME10", "FLAT100", "FREESHIP", "INVALIDXYZ"]

# Statuses that are valid responses, not failures, per endpoint group.
READ_OK = {200, 304}
ORDER_OK = {200, 400, 409, 422, 429}     # business outcomes + rate limit
AUTH_OK = {200, 401, 429}                # bad creds / rate limit are healthy


def rand(n):
    return "".join(random.choices(string.ascii_lowercase + string.digits, k=n))


def phone():
    return ("9" + str(random.randint(100000000, 999999999)))[:10]


# -- Users (weights encode the 70/20/8/2 traffic mix) ----------------------
class StorefrontUser(HttpUser):
    """Browsing + cart + checkout customer. Weighted so 70% browse, 20% cart,
    8% checkout within this user (admin is its own user class at 2%)."""
    weight = 98
    wait_time = between(1, 4)  # think-time between actions

    def _check(self, resp, ok_set, name):
        if resp.status_code in ok_set:
            resp.success()
        else:
            resp.failure(f"{name}: unexpected {resp.status_code}")

    @task(70)
    def browse(self):
        slug = random.choice(PRODUCT_SLUGS)
        with self.client.get("/", name="homepage", catch_response=True) as r:
            self._check(r, READ_OK, "homepage")
        with self.client.get(f"/product/{slug}", name="pdp", catch_response=True) as r:
            self._check(r, READ_OK, "pdp")
        with self.client.get(f"/api/stock?skuIds={slug}", name="stock", catch_response=True) as r:
            self._check(r, READ_OK, "stock")

    @task(20)
    def cart(self):
        slug = random.choice(PRODUCT_SLUGS)
        pincode = random.choice(SERVICEABLE_PINCODES)
        with self.client.get(f"/product/{slug}", name="pdp", catch_response=True) as r:
            self._check(r, READ_OK, "pdp")
        with self.client.get(f"/api/stock?skuIds={slug}", name="stock", catch_response=True) as r:
            self._check(r, READ_OK, "stock")
        with self.client.get(f"/api/serviceability?pincode={pincode}",
                             name="serviceability", catch_response=True) as r:
            self._check(r, READ_OK, "serviceability")

    @task(8)
    def checkout(self):
        pincode = random.choice(SERVICEABLE_PINCODES)
        with self.client.get("/checkout", name="checkout_page", catch_response=True) as r:
            self._check(r, READ_OK, "checkout_page")
        with self.client.get(f"/api/serviceability?pincode={pincode}",
                             name="serviceability", catch_response=True) as r:
            self._check(r, READ_OK, "serviceability")
        coupon = random.choice(COUPON_CODES)
        with self.client.get(
            f"/api/coupons/validate?code={coupon}&siteId=prc&subtotalInr=1299&shippingInr=0",
            name="coupon_validate", catch_response=True,
        ) as r:
            self._check(r, READ_OK, "coupon_validate")

        if ENABLE_WRITES:
            self._place_order(pincode)

    def _place_order(self, pincode):
        prepaid = random.random() < PREPAID_RATIO
        body = {
            "siteId": "prc",
            "idempotencyKey": f"loc-{int(time.time()*1000)}-{rand(20)}",
            "items": [{"skuId": TEST_SKU, "variantSlug": None, "qty": 1}],
            "address": {
                "fullName": f"Locust {rand(5)}",
                "phone": phone(),
                "email": f"loc+{rand(8)}@example.com",
                "line1": "1 Locust Rd",
                "city": "Bengaluru",
                "state": "Karnataka",
                "pincode": pincode,
            },
            "paymentMethod": "UPI" if prepaid else "COD",
        }
        name = "order_prepaid" if prepaid else "order_cod"
        with self.client.post("/api/orders/create", json=body, name=name,
                              catch_response=True) as r:
            if r.status_code in ORDER_OK:
                r.success()
            elif r.status_code == 503:
                r.failure("order: 503 DB unavailable / pool exhaustion")
            else:
                r.failure(f"order: unexpected {r.status_code}")


class AdminUser(HttpUser):
    """2% of traffic. Login attempts expect 401/429 (healthy). Only 5xx /
    timeouts / connection-closed count as failures."""
    weight = 2
    wait_time = between(1, 3)

    @task
    def admin_login(self):
        with self.client.get("/admin/login", name="admin_login_page",
                             catch_response=True) as r:
            if r.status_code in READ_OK:
                r.success()
            else:
                r.failure(f"admin_login_page: {r.status_code}")
        body = {"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        with self.client.post("/api/admin/signin", json=body, name="admin_signin",
                              catch_response=True) as r:
            if r.status_code in AUTH_OK:
                r.success()  # 401/429 are expected & healthy
            elif r.status_code >= 500:
                r.failure(f"admin_signin: SERVER ERROR {r.status_code}")
            else:
                r.failure(f"admin_signin: unexpected {r.status_code}")


# -- Staged load shape: ramp 5m -> sustain 15m -> ramp-down 5m -------------
RAMP = int(env("RAMP_MINUTES", "5")) * 60
SUSTAIN = int(env("SUSTAIN_MINUTES", "15")) * 60
RAMPDOWN = int(env("RAMPDOWN_MINUTES", "5")) * 60
STAGE = env("STAGE", "1").lower()
STAGE_PEAKS = {"1": 100, "2": 250, "3": 500, "4": 1000}


def _build_stages():
    """Returns list of (end_time_seconds, target_users, spawn_rate)."""
    if STAGE == "full":
        stages, t = [], 0
        for peak in (100, 250, 500, 1000):
            t += RAMP
            stages.append((t, peak, max(1, peak // (RAMP // 60) // 60 + 1)))
            t += SUSTAIN
            stages.append((t, peak, 50))
        t += RAMPDOWN
        stages.append((t, 0, 50))
        return stages
    peak = int(env("TARGET_VUS", STAGE_PEAKS.get(STAGE, 100)))
    spawn = max(1, round(peak / RAMP, 2))  # reach peak by end of ramp
    return [
        (RAMP, peak, spawn),
        (RAMP + SUSTAIN, peak, spawn),
        (RAMP + SUSTAIN + RAMPDOWN, 0, spawn),
    ]


class StagedShape(LoadTestShape):
    stages = _build_stages()

    def tick(self):
        run_time = self.get_run_time()
        for end_time, users, spawn_rate in self.stages:
            if run_time < end_time:
                return (users, spawn_rate)
        return None  # all stages done -> stop the test


# -- Live verdict against success criteria ---------------------------------
@events.quitting.add_listener
def _assert_success_criteria(environment, **_kw):
    stats = environment.stats.total
    fail_ratio = stats.fail_ratio
    p95 = stats.get_response_time_percentile(0.95)
    p99 = stats.get_response_time_percentile(0.99)
    print("\n-- Locust verdict vs success criteria -------------")
    print(f"  error rate : {fail_ratio*100:.2f}%   (target < 1%)")
    print(f"  p95        : {p95} ms              (target < 2000)")
    print(f"  p99        : {p99} ms              (target < 5000)")
    failed = False
    if fail_ratio > 0.01:
        print("  [FAIL] error rate exceeded 1%")
        failed = True
    if p95 and p95 > 2000:
        print("  [FAIL] p95 exceeded 2s")
        failed = True
    if p99 and p99 > 5000:
        print("  [FAIL] p99 exceeded 5s")
        failed = True
    environment.process_exit_code = 1 if failed else 0
    print("  RESULT:", "FAIL" if failed else "PASS")