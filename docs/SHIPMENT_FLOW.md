# Shipment Flow — pocketrccars.com

End-to-end map of how an order goes from "paid" → "delivered" through the Shiprocket pipeline.

Last updated: 2026-06-09. Source of truth: the code paths cited below.

---

## TL;DR

```
[verify | razorpay-webhook | cod-confirm | reconcile-cron]
            │
            ▼ INSERT shipment_jobs (PK collapse → 1 row per order)
       PENDING ──claim──▶ PROCESSING ──Shiprocket──▶ DONE
            ▲                  │
            │backoff           │permanent? ─▶ FAILED + alertOps
            └─error────────────┘
                  │
                  ▼ on success
          orders.status = PACKED + awb_code + shiprocket_*

PACKED ──cron-poll OR webhook──▶ SHIPPED ──▶ DELIVERED
              │
              └─cancel (from /pack or /admin) ─▶ CANCELLED
                                                  │
                                                  ▼
                                       inventory + coupon released
```

The two invariants the whole system rests on:

1. **One shipment job per order** — `shipment_jobs.order_id` is the PK.
2. **One Shiprocket order per order** — `create-shipment.ts` early-returns when `shiprocket_order_id + awb_code` are already set.

Everything else is retries, status mirroring, and operator UI around those two.

---

## 1. Trigger — getting onto the queue

A `shipment_jobs` row is inserted with `INSERT ... ON CONFLICT DO NOTHING` from **four** entry points. Whichever fires first wins; the rest collapse onto the same row.

| Entry point | Fires when | File |
|---|---|---|
| `/api/orders/[id]/verify` | Razorpay client-side payment confirmation lands | `src/app/api/orders/[id]/verify/route.ts` |
| `/api/webhooks/razorpay` | Razorpay server-side webhook (the race-safe backup if the client never pings verify) | `src/app/api/webhooks/razorpay/route.ts` |
| `src/app/cod/actions.ts` | COD operator clicks "Confirm" in `/cod` | `src/app/cod/actions.ts` |
| `/api/cron/reconcile` | Safety-net drain — enqueues any PAID/PACKED order with no `shiprocket_order_id` and no job row | `src/app/api/cron/reconcile/route.ts` |

The helper itself:

```ts
// src/lib/fulfillment/shipment-queue.ts:45-50
export async function enqueueShipmentJob(orderId: string): Promise<void> {
  await db
    .insert(shipmentJobs)
    .values({ orderId, status: "PENDING" })
    .onConflictDoNothing({ target: shipmentJobs.orderId });
}
```

**Why four entry points and not one?** Verify can be lost (closed tab, dead network), the webhook can arrive first or last, the operator can rescue manually, and the cron picks up everything everyone else missed. Each path is independently safe because of the PK collapse.

---

## 2. Claim — the lock

A worker takes the job with an atomic `PENDING → PROCESSING` UPDATE. The conditional `WHERE status = 'PENDING'` is the lock — only one worker can win the row:

```ts
// src/lib/fulfillment/shipment-queue.ts:143-158
const claimed = await db
  .update(shipmentJobs)
  .set({
    status: "PROCESSING",
    lockedAt: new Date(),
    attempts: sql`${shipmentJobs.attempts} + 1`,
    updatedAt: new Date(),
  })
  .where(
    and(
      eq(shipmentJobs.orderId, orderId),
      eq(shipmentJobs.status, "PENDING"),
      lte(shipmentJobs.nextAttemptAt, new Date()),
    ),
  )
  .returning(...);
```

The Shiprocket network call happens **after** the claim commits — we never hold a row lock across an external API request. The PROCESSING state itself is the lease; the cron reaps stuck PROCESSING rows older than 5 minutes back to PENDING.

The cron version uses `FOR UPDATE SKIP LOCKED` so overlapping cron runs never contend:

```sql
-- src/lib/fulfillment/shipment-queue.ts:218-231
WITH due AS (
  SELECT order_id FROM shipment_jobs
  WHERE status = 'PENDING' AND next_attempt_at <= now()
  ORDER BY next_attempt_at
  LIMIT $batchSize
  FOR UPDATE SKIP LOCKED
)
UPDATE shipment_jobs s
  SET status = 'PROCESSING', locked_at = now(),
      attempts = s.attempts + 1, updated_at = now()
  FROM due WHERE s.order_id = due.order_id
  RETURNING s.order_id, s.attempts, s.max_attempts
```

---

## 3. Shiprocket call — actual shipment creation

The Shiprocket interaction is wrapped in one function so the HTTP route and the queue worker behave identically:

```ts
// src/lib/fulfillment/create-shipment.ts:65
createShipmentForOrder(orderId: string): Promise<ShipmentResult>
```

It:

1. Loads the order
2. **Idempotency guard** — if `order.shiprocketOrderId && order.awbCode` are both set, returns the existing record with `idempotent: true`. We never re-charge Shiprocket for an order we already shipped.
3. Pushes the order to Shiprocket (Create Order endpoint), gets back `shiprocket_order_id`
4. Assigns AWB / courier, gets `shipment_id`, `awb_code`, `courier_name`, `tracking_url`
5. Saves all five fields onto `orders` and flips `status = PACKED`
6. Inserts an event row + fires `notifyOrderEvent(orderId, "ORDER_SHIPPED")` (the customer notification)

Error model:

| Error | Permanent? | What happens |
|---|---|---|
| `NotShippableError` (order is CANCELLED / REFUNDED / PENDING / FAILED) | yes | Job → FAILED immediately. No retry. |
| `OrderNotFoundError` | yes | Job → FAILED. |
| Shiprocket 5xx, network timeout, anything else | no | Job → PENDING with back-off. |

---

## 4. Retry & back-off

On transient failure the job goes back to PENDING with `next_attempt_at = now() + backoff`:

```ts
// src/lib/fulfillment/shipment-queue.ts:36-39
function backoffSeconds(attempt: number): number {
  // 1m, 2m, 4m, 8m, 16m, capped at 30m.
  return Math.min(60 * 2 ** Math.max(0, attempt - 1), 1800);
}
```

After `max_attempts` (default 5) the job is parked FAILED and `alertOps` fires:

```
Shipment creation FAILED permanently for {orderId} after {attempts} attempts
```

Failed jobs are visible to the cron summary via `countFailedShipmentJobs()`.

---

## 5. Status mirroring — keeping orders.status in sync with Shiprocket

There are **two** paths because Shiprocket's webhook UI has a broken Save button. The cron is the primary, the webhook is the fallback for when they fix it.

### 5a. Primary: cron polling (`/api/cron/sync-shipments`)

Runs every 10 minutes via Vercel Cron. For every order in `PACKED` or `SHIPPED` with a `shiprocket_shipment_id`:

1. Calls `getShipmentStatus(shipmentId)` against Shiprocket
2. Maps Shiprocket status text → our enum (`mapShiprocketStatus`)
3. If the mapped value differs from `orders.status`:
   - Updates `status`, stamps the matching `*_at` column (`shippedAt` / `deliveredAt` / `cancelledAt`)
   - Writes a `POLL_SHIPROCKET_{NEW_STATUS}` event
   - Fires customer notification: `SHIPPED → OUT_FOR_DELIVERY`, `DELIVERED → DELIVERED`
4. Skips terminal statuses (`DELIVERED`, `CANCELLED`, `RETURNED`, `REFUNDED`) — no point paying Shiprocket for status calls on dead shipments

The cron also piggybacks `drainNotificationsOutbox(200)` at the end because on Vercel Hobby we only get one daily cron slot.

Auth: requires `Authorization: Bearer ${CRON_SECRET}` (Vercel Cron sends this automatically; the path is listed in `vercel.json`).

### 5b. Secondary: webhook (`/api/webhooks/courier`)

The path is renamed away from `/shiprocket` because their URL validator literally rejects any URL containing the string "shiprocket". The handler is deliberately probe-tolerant — anything other than HTTP 200 makes Shiprocket's validator report "Please check your endpoint":

- **GET / HEAD** → ack 200 (reachability probes)
- **POST without `x-api-key`** → ack 200 (auth probes)
- **POST with empty / malformed body** → ack 200 (shape probes)
- **POST with valid `x-api-key` + JSON body** → real path: dedup on `(source, external_id)`, update order, fire notifications

On a CANCELLED webhook the handler ALSO calls `releaseOrderHoldsBestEffort(orderId, "CANCELLED")` so the reserved stock returns to the pool.

Dedup key:

```
${event.order_id ?? event.awb ?? "unknown"}::${status}::${status_id}
```

— our order ID is tried first because it's globally unique, AWB is the fallback.

---

## 6. Operator surfaces — what humans see

### `/pack` — the packing employee console

Three tabs, mobile-first dark UI:

| Tab | Filter | Actions |
|---|---|---|
| **TO PACK** | `status = PACKED AND awb_code IS NOT NULL` | Print label · Invoice · Cancel · Mark dispatched · (footer) Manifest · Schedule pickup |
| **AWB PENDING** | `status = PAID` OR `(status = PACKED AND awb_code IS NULL)` | Cancel only (label / invoice / dispatch gated until AWB lands) |
| **DISPATCHED** | `status = SHIPPED AND shipped_at > now() - 24h` | Read-only |

Auth: HMAC-signed cookie via `src/lib/pack-auth.ts`. Separate from `/admin` and `/cod` — least-privilege for the packing employee.

Actions live in `src/app/pack/actions.ts`:

- `printLabelAction(orderId)` → `generateShippingLabel([shipmentId])`
- `printInvoiceAction(orderId)` → `generateInvoice([shiprocketOrderId])`
- `printManifestAction()` → `generateManifest(allPackedShipmentIds)`
- `schedulePickupAction()` → `schedulePickup(allPackedShipmentIds)`
- `markDispatchedAction(orderId)` → `status = SHIPPED` + revalidate 6 paths
- `markBulkDispatchedAction(ids)` → same, batched
- `cancelOrderFromPackAction(orderId, reason)` → see §7

### `/admin` — full admin console

Has the manual retry button: `/api/orders/[id]/ship` calls `runShipmentJobOnce(orderId)` synchronously, useful when a packer flags a stuck order.

### `/cod` — COD verification console

The cashier here confirms COD orders, which is one of the four enqueue entry points (see §1).

---

## 7. Cancel propagation — the 6 places a cancel hits

When the packer taps Cancel in `/pack` (commit `9450885`), the action does **six** things atomically:

| # | Effect | Why |
|---|---|---|
| 1 | `cancelShiprocketOrder(shiprocket_order_id)` | Stops Shiprocket from billing for the AWB |
| 2 | `shipment_jobs.status = FAILED` (where status IN PENDING, PROCESSING) | Stops the queue worker from retrying create-order against a dead order |
| 3 | `releaseOrderHoldsBestEffort(orderId, "CANCELLED")` | Returns reserved stock + coupon redemption to the pool |
| 4 | `orders.status = CANCELLED`, `cancelledAt = now()` | Canonical store flip |
| 5 | `events` insert: `type: "CANCELLED_FROM_PACK"`, payload includes operator reason | Audit trail |
| 6 | `revalidatePath` on `/pack`, `/cod`, `/admin/orders`, `/admin/orders/[id]`, `/orders/[id]`, `/track` | Every surface that renders this order re-fetches from DB on next visit |

The webhook path (§5b) does steps 4 + 3 when the cancel originates from Shiprocket's side instead.

Refunds for prepaid orders are deliberately NOT triggered from `/pack` — that stays an admin action so the packer can't accidentally refund a customer.

---

## 8. State machine

```
   PENDING (pre-payment, abandoned cart territory)
      │
      ▼ payment captured
    PAID ─────────────────────────────────────┐
      │                                       │
      │ shipment job created + run            │ /pack or /admin cancel
      ▼                                       ▼
   PACKED ◀─── waits for AWB ──┐         CANCELLED
      │                        │             ▲
      │ cron / webhook         │             │
      ▼                        │             │
   SHIPPED ──────────────┐     │             │
      │                  │     │             │
      │ cron / webhook   │     │             │
      ▼                  ▼     ▼             │
   DELIVERED         RETURNED  ─────cancel───┘
                         │
                         ▼ admin refund
                     REFUNDED
```

Terminal states (no further polling, no further state changes): **DELIVERED**, **CANCELLED**, **RETURNED**, **REFUNDED**.

---

## 9. Files at a glance

| Concern | Path |
|---|---|
| Queue (enqueue / claim / drain / retry / failed-count) | `src/lib/fulfillment/shipment-queue.ts` |
| Shiprocket-facing create logic + idempotency | `src/lib/fulfillment/create-shipment.ts` |
| Shiprocket HTTP client + status mapper + label / invoice / manifest / pickup / cancel | `src/lib/shiprocket.ts` |
| Status-mirror cron | `src/app/api/cron/sync-shipments/route.ts` |
| Status-mirror webhook (probe-tolerant) | `src/app/api/webhooks/courier/route.ts` |
| Orphan-job + reaper cron | `src/app/api/cron/reconcile/route.ts` |
| Admin retry HTTP | `src/app/api/orders/[id]/ship/route.ts` |
| Enqueue from verify | `src/app/api/orders/[id]/verify/route.ts` |
| Enqueue from Razorpay server webhook | `src/app/api/webhooks/razorpay/route.ts` |
| Enqueue from COD confirm | `src/app/cod/actions.ts` |
| /pack page (3-tab console) | `src/app/pack/page.tsx` |
| /pack server actions (print / dispatch / cancel) | `src/app/pack/actions.ts` |
| /pack auth | `src/lib/pack-auth.ts` |
| Inventory + coupon release on cancel | `src/lib/inventory/release.ts` |
| Customer notifications outbox | `src/lib/notifications/notify.ts`, `src/lib/notifications/drain.ts` |

---

## 10. Things to know if something looks stuck

| Symptom | Where to look |
|---|---|
| Order in PAID with no AWB after 30s | `shipment_jobs` row — what's `status`, `attempts`, `last_error`, `next_attempt_at`? |
| Order in PACKED but no AWB shown on /pack | The Shiprocket call succeeded for `shiprocket_order_id` but AWB assignment is pending. Cron polls it. |
| Order in PACKED forever, never goes to SHIPPED | Cron isn't running, or Shiprocket's status text isn't in `mapShiprocketStatus`. Check `/api/cron/sync-shipments` last-run + the `POLL_SHIPROCKET_*` events. |
| Cancel from /pack didn't reflect in /admin | Revalidation only refreshes on next navigation — hard-refresh the admin tab. |
| Webhook arrives but order doesn't update | Probably `x-api-key` mismatch (returns 200 silently by design). Check `SHIPROCKET_WEBHOOK_TOKEN` env. |
| `shipment_jobs` row stuck in PROCESSING for >5 min | Reconcile cron will reap it back to PENDING. If never reaped, the cron itself isn't firing. |
