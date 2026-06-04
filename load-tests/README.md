# Load & Stress Testing -- bch-rc (Pocket RC storefront)

Production-readiness load suite for the Next.js 16 + Supabase storefront.
Three independent implementations of the **same** customer journeys and traffic
mix so you can cross-check results:

| Tool      | Strength                                   | Folder        |
|-----------|--------------------------------------------|---------------|
| **k6**    | Primary. Best metrics, thresholds, stages. | [`k6/`](k6/)         |
| **Artillery** | YAML-first, easy CI, good for smoke runs. | [`artillery/`](artillery/) |
| **Locust**    | Python, great live web UI, custom shapes. | [`locust/`](locust/)   |

> **Goal:** simulate 1,000 concurrent customers, find the bottleneck *before*
> launch, and prove the success criteria below.

---

## 0. Read this first -- architecture realities that shape the test

This app runs **Vercel serverless + Supabase Supavisor transaction pooler
(port 6543)**, `postgres-js` with `max: 3` connections **per Lambda instance**
(see [`src/db/index.ts`](../src/db/index.ts)). Three consequences drive how you must read results:

1. **Connection-pool exhaustion is governed by Supavisor, not the app.** Under
   1,000 concurrent users Vercel fans out to many Lambda instances, each opening
   up to 3 pooled connections. The ceiling you hit is the **Supavisor pool size**
   (Supabase dashboard -> Database -> Connection pooling). When it's exceeded you
   see `Connection closed` / `connect_timeout`, retried once by `withDbRetry`,
   then surfaced as `DatabaseUnavailableError` -> HTTP 503. **Watch for 503s; they
   are the pool-exhaustion signal.**

2. **The write path has real side effects.** `POST /api/orders/create`
   ([route](../src/app/api/orders/create/route.ts)) decrements real inventory,
   upserts customers, writes the notifications outbox, and **creates real
   Razorpay orders** (prepaid). These tests are configured for **STAGING ONLY**
   with the `qa-1rs` Rs.16 test SKU and Razorpay **test** keys.

3. **Auth is rate-limited *by design*.** `/api/admin/signin` = 5/email + 20/IP
   per 15 min; `/api/cod/login` = 20/IP per 15 min
   ([signin](../src/app/api/admin/signin/route.ts), [cod](../src/app/api/cod/login/route.ts)).
   A load generator has **one source IP**, so 1,000 login attempts will
   *correctly* return mostly **429**. The auth test treats `401`/`429` as the
   **expected, healthy** response and only flags `500` / timeout /
   `Connection closed` as failures. Don't read the 429 wall as a regression -- it
   is the rate limiter doing its job.

---

## 1. Customer journeys & traffic mix (identical across all three tools)

| Journey            | Weight | HTTP it generates                                                                 |
|--------------------|:------:|-----------------------------------------------------------------------------------|
| **Browsing**       |  70%   | `GET /` -> `GET /product/{slug}` -> `GET /api/stock?skuIds=...`                    |
| **Cart activity**  |  20%   | PDP view -> `GET /api/stock` -> `GET /api/serviceability` (add-to-cart itself is client-side Zustand state -- no server call) |
| **Checkout**       |   8%   | `GET /checkout` -> `GET /api/serviceability` -> `GET /api/coupons/validate` -> *(writes)* `POST /api/orders/create` |
| **Admin**          |   2%   | `GET /admin/login` -> `POST /api/admin/signin` (expects 401/429)                   |

> **Add to cart / checkout start** are deliberately modelled as the *network
> calls that actually happen* around those UI actions (stock refresh,
> serviceability, coupon preview). The cart lives in client state, so there is no
> "add to cart" API to load -- faking one would measure nothing real.

The **order-placement** write inside the checkout journey uses the `qa-1rs` SKU
and a **mix of ~80% COD / 20% prepaid** (COD exercises the full DB transaction
without Razorpay; prepaid also exercises the Razorpay order-create call).

---

## 2. Load stages

Each stage uses the requested **ramp-up 5 min -> sustain 15 min -> ramp-down 5 min**
profile (25 min/stage).

| Stage | Peak VUs |
|:-----:|:--------:|
| 1     |   100    |
| 2     |   250    |
| 3     |   500    |
| 4     |  1000    |

Run them **one at a time**, smallest first, and stop escalating the moment a
stage breaches the success criteria -- that stage *is* your bottleneck. A `full`
mode chains all four back-to-back for a ~100-min soak.

---

## 3. Success criteria (the test's pass/fail gate)

| Metric                       | Threshold      |
|------------------------------|----------------|
| Error rate (real failures)   | **< 1%**       |
| P95 latency                  | **< 2 s**      |
| P99 latency                  | **< 5 s**      |
| Auth failures (500/timeout)  | **0** (429/401 don't count) |
| DB crashes / pool exhaustion | **none** (no sustained 503s) |

k6 encodes these as `thresholds`; a breached threshold makes `k6 run` exit
non-zero (CI-friendly). Artillery encodes them as `ensure`. Locust prints them
and the bundled shape stops on breach.

---

## 4. Install

### Common
```powershell
# from repo root
cd load-tests
copy .env.example .env        # then edit .env  (PowerShell)
# bash:  cp .env.example .env
```

### k6  (primary)
```powershell
winget install k6 --source winget      # Windows
# macOS:  brew install k6
# Linux:  https://grafana.com/docs/k6/latest/set-up/install-k6/
k6 version
```

### Artillery
```powershell
npm install -g artillery@latest
artillery version
```

### Locust
```powershell
python -m pip install -r locust/requirements.txt
locust --version
```

---

## 5. Environment variables (`.env`)

See [`.env.example`](.env.example). All three tools read the same vars.

| Var                       | Meaning                                                                 |
|---------------------------|-------------------------------------------------------------------------|
| `BASE_URL`                | Staging origin, e.g. `https://staging.pocketrc.example`. **No trailing slash.** |
| `ENABLE_WRITES`           | `true` to run `POST /api/orders/create`. **Staging only.** Default `false`. |
| `PREPAID_RATIO`           | Fraction of orders that go prepaid (0-1). Default `0.2`.                 |
| `TARGET_VUS` / `STAGE`    | k6: peak VUs or stage selector (`1`/`2`/`3`/`4`/`full`).                 |
| `RAMP_MINUTES` / `SUSTAIN_MINUTES` / `RAMPDOWN_MINUTES` | Stage timing. Default `5`/`15`/`5`. |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Throwaway creds for the auth stress test (expects 401/429). |
| `COD_USERNAME` / `COD_PASSWORD`  | COD console creds for the auth test.                        |
| `TEST_SKU`                | Order-create SKU. Default `qa-1rs`. **Keep it the test SKU.**            |
| `SERVICEABLE_PINCODES`    | Comma list of metro pincodes (COD-enabled). Default Bangalore/Mumbai/Delhi. |

---

## 6. Run

### k6
```powershell
# Stage 1 -- 100 VUs, 25 min
$env:BASE_URL="https://staging.pocketrc.example"; $env:STAGE="1"; k6 run k6/main.js

# Stage 4 -- 1000 VUs, with writes enabled (staging!)
$env:STAGE="4"; $env:ENABLE_WRITES="true"; k6 run k6/main.js

# Full step-load soak (100->250->500->1000)
$env:STAGE="full"; k6 run k6/main.js

# JSON + HTML summary out
k6 run --summary-export=summary.json k6/main.js

# Auth stress -- 1000 login attempts (expect a wall of 429; flags only 5xx/timeouts)
$env:STAGE="4"; k6 run k6/auth-stress.js

# DB / connection-pool stress (read+write hot loop)
$env:ENABLE_WRITES="true"; k6 run k6/db-stress.js
```
> bash: `BASE_URL=... STAGE=4 k6 run k6/main.js`

### Artillery
```powershell
artillery run --dotenv .env artillery/artillery.yml
artillery run --dotenv .env artillery/artillery.yml --output report.json
artillery report report.json          # -> report.json.html
```

### Locust
```powershell
# Headless, stage 4, CSV out
locust -f locust/locustfile.py --headless -u 1000 -r 4 --run-time 25m `
       --host $env:BASE_URL --csv results/stage4

# Web UI (watch live percentiles): open http://localhost:8089
locust -f locust/locustfile.py --host $env:BASE_URL
```
`-r 4` ~= 1000 VUs over a 5-min ramp (1000/300s). The bundled `StagedShape`
reproduces the exact ramp/sustain/ramp-down driven by the `STAGE` var in `.env`
(it overrides `-u`/`-r`).

---

## 7. What to watch *while* it runs

Latency/error numbers come from the tools. The server-side bottleneck signals
live in Supabase + Vercel -- see [`MONITORING.md`](MONITORING.md) for the exact
dashboards, SQL probes (active connections, slow queries, locks, deadlocks), and
the `/api/health/inventory` probe to confirm the catalog stayed healthy under
load.

---

## 8. Safety checklist before a write run

- [ ] `BASE_URL` points at **staging**, not prod.
- [ ] Razorpay **test** keys configured on that environment.
- [ ] `qa-1rs` seeded with **large** stock on staging (`npm run db:seed-inventory`)
      -- otherwise it sells out mid-test and returns business-`409`s (handled as
      non-errors, but they end the write coverage).
- [ ] You can afford the email volume (COD orders enqueue a confirmation email).
- [ ] `ENABLE_WRITES=true` is set **intentionally**, per run.