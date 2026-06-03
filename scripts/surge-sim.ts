/**
 * Surge simulation — concurrency harness for the order/payment/fulfillment
 * pipeline. Runs entirely in-memory (no DB, no network) and faithfully models
 * the atomic primitives the production code relies on:
 *
 *   - inventory reserve  ≙ `UPDATE inventory SET stock=stock-q WHERE stock>=q`
 *                          (one atomic SQL statement → modelled as an atomic
 *                           synchronous compare-and-set; cannot oversell)
 *   - holds release      ≙ `UPDATE orders SET holds_released=true
 *                           WHERE holds_released=false` (exactly-once claim)
 *   - shipment job       ≙ INSERT ON CONFLICT DO NOTHING (one job per order)
 *                          + PENDING→PROCESSING atomic claim (one worker runs)
 *   - notification       ≙ unique dedup_key + lease claim (one send)
 *   - coupon reserve     ≙ gated used_count++ ; release ≙ used_count--
 *
 * Concurrency is real: every "user" runs as an interleaved async task, the
 * payment confirmation fans out /verify and the Razorpay webhook CONCURRENTLY
 * (the exact race that used to double-ship), and double-clicks fire two
 * create calls with the same idempotency key at once. The atomic sections are
 * synchronous (no await inside) — mirroring a single atomic SQL statement.
 *
 * Run: npx tsx scripts/surge-sim.ts
 */

/* eslint-disable no-console */

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const jitter = () => sleep(Math.floor(Math.random() * 3));

// ── In-memory store with atomic primitives ────────────────────────────────
type Order = {
  id: string;
  status: "PENDING" | "PAID" | "FAILED" | "ABANDONED";
  holdsReleased: boolean;
  units: number;
  couponId: string | null;
};

class Store {
  stock: number;
  initialStock: number;
  coupon = { used: 0, limit: 0 };
  orders = new Map<string, Order>();
  idempo = new Map<string, string>(); // idempotencyKey -> orderId
  shipmentJobs = new Map<string, "PENDING" | "PROCESSING" | "DONE">();
  shipmentsCreated = new Map<string, number>(); // orderId -> times Shiprocket was actually called
  notifications = new Map<string, boolean>(); // dedupKey -> exists (unique)
  emailsSent = new Map<string, number>(); // dedupKey -> times actually dispatched
  oversellDetected = false;

  constructor(stock: number, couponLimit: number) {
    this.stock = stock;
    this.initialStock = stock;
    this.coupon.limit = couponLimit;
  }

  /** Atomic gated decrement. Returns true if reserved. */
  reserveStock(units: number): boolean {
    if (this.stock >= units) {
      this.stock -= units;
      if (this.stock < 0) this.oversellDetected = true;
      return true;
    }
    return false;
  }

  restoreStock(units: number): void {
    this.stock += units;
  }

  /** Atomic gated coupon redeem. */
  reserveCoupon(): boolean {
    if (this.coupon.used < this.coupon.limit) {
      this.coupon.used += 1;
      return true;
    }
    return false;
  }

  releaseCoupon(): void {
    if (this.coupon.used > 0) this.coupon.used -= 1;
  }

  /** Exactly-once holds release (inventory + coupon). */
  releaseHolds(orderId: string): boolean {
    const o = this.orders.get(orderId);
    if (!o || o.holdsReleased) return false; // atomic claim
    o.holdsReleased = true;
    this.restoreStock(o.units);
    if (o.couponId) this.releaseCoupon();
    return true;
  }

  /** INSERT ON CONFLICT DO NOTHING — one job per order. */
  enqueueShipmentJob(orderId: string): void {
    if (!this.shipmentJobs.has(orderId)) this.shipmentJobs.set(orderId, "PENDING");
  }

  /** Atomic PENDING→PROCESSING claim. Returns true if THIS caller won. */
  claimShipmentJob(orderId: string): boolean {
    if (this.shipmentJobs.get(orderId) === "PENDING") {
      this.shipmentJobs.set(orderId, "PROCESSING");
      return true;
    }
    return false;
  }

  finishShipmentJob(orderId: string): void {
    this.shipmentJobs.set(orderId, "DONE");
  }

  /** Unique dedup_key enqueue. Returns true if THIS caller created the row. */
  enqueueNotification(dedupKey: string): boolean {
    if (this.notifications.has(dedupKey)) return false;
    this.notifications.set(dedupKey, true);
    return true;
  }
}

// ── Pipeline operations (each atomic section is synchronous) ───────────────

async function createOrder(
  store: Store,
  idempotencyKey: string,
  orderId: string,
  units: number,
  useCoupon: boolean,
): Promise<{ orderId: string; ok: boolean; replayed: boolean }> {
  // Idempotency short-circuit (atomic check-or-claim).
  const existing = store.idempo.get(idempotencyKey);
  if (existing) return { orderId: existing, ok: true, replayed: true };

  await jitter();

  // Reserve stock atomically; reject (sold out) if insufficient.
  if (!store.reserveStock(units)) return { orderId, ok: false, replayed: false };

  let couponId: string | null = null;
  if (useCoupon) {
    if (store.reserveCoupon()) couponId = "LAUNCH";
    // If coupon exhausted we still allow the order (no discount) — matches
    // "coupon yields no discount" being non-fatal at the catalog level.
  }

  // Claim the idempotency key; if we lost the race, roll back our reservation.
  if (store.idempo.has(idempotencyKey)) {
    store.restoreStock(units);
    if (couponId) store.releaseCoupon();
    return { orderId: store.idempo.get(idempotencyKey)!, ok: true, replayed: true };
  }
  store.idempo.set(idempotencyKey, orderId);
  store.orders.set(orderId, { id: orderId, status: "PENDING", holdsReleased: false, units, couponId });
  return { orderId, ok: true, replayed: false };
}

/** /verify and the webhook both call this; only the winner ships + emails. */
async function confirmPaymentPath(store: Store, orderId: string): Promise<void> {
  store.enqueueShipmentJob(orderId);
  await jitter();
  if (store.claimShipmentJob(orderId)) {
    await jitter(); // emulate the Shiprocket API call window
    store.shipmentsCreated.set(orderId, (store.shipmentsCreated.get(orderId) ?? 0) + 1);
    store.finishShipmentJob(orderId);
  }

  const dedupKey = `${orderId}:PAYMENT_CAPTURED:email`;
  const created = store.enqueueNotification(dedupKey);
  await jitter();
  if (created) {
    store.emailsSent.set(dedupKey, (store.emailsSent.get(dedupKey) ?? 0) + 1);
  }
}

// ── One simulated user ─────────────────────────────────────────────────────

async function runUser(store: Store, i: number): Promise<void> {
  const orderId = `ORD-${i}`;
  const idempotencyKey = `idem-${i}`;
  const units = 1;
  const useCoupon = i % 3 === 0; // a third of users apply the launch coupon

  // Double-click: two concurrent create calls, same idempotency key.
  const [a, b] = await Promise.all([
    createOrder(store, idempotencyKey, orderId, units, useCoupon),
    createOrder(store, idempotencyKey, `${orderId}-dup`, units, useCoupon),
  ]);
  const res = a.ok ? a : b;
  if (!res.ok) return; // sold out — clean rejection, nothing reserved

  const realOrderId = res.orderId;
  const order = store.orders.get(realOrderId)!;

  await jitter();

  // Payment outcome: 70% pay, 20% explicit fail, 10% pure timeout (no signal).
  const roll = i % 10;
  if (roll < 7) {
    order.status = "PAID";
    // Race /verify against the Razorpay webhook.
    await Promise.all([confirmPaymentPath(store, realOrderId), confirmPaymentPath(store, realOrderId)]);
  } else if (roll < 9) {
    order.status = "FAILED";
    store.releaseHolds(realOrderId); // payment.failed webhook
  } else {
    // Pure timeout: customer vanished, no webhook. Left PENDING for the sweeper.
  }
}

// ── Reconcile sweep (cron) — abandons stale PENDING + releases holds ───────
function reconcileSweep(store: Store): number {
  let swept = 0;
  for (const o of store.orders.values()) {
    if (o.status === "PENDING") {
      o.status = "ABANDONED"; // atomic flip claim
      if (store.releaseHolds(o.id)) swept++;
    }
  }
  return swept;
}

// ── Invariant checks ───────────────────────────────────────────────────────

type Result = {
  users: number;
  created: number;
  paid: number;
  soldOut: number;
  finalStock: number;
  oversold: boolean;
  dupShipments: number;
  dupEmails: number;
  paidWithoutShipment: number;
  stockConserved: boolean;
  couponConserved: boolean;
  lostOrders: number;
};

async function simulate(users: number): Promise<Result> {
  // Stock deliberately scarce (~55% of demand) to force sell-outs + releases.
  const stock = Math.floor(users * 0.55);
  const couponLimit = Math.floor(users / 4);
  const store = new Store(stock, couponLimit);

  await Promise.all(Array.from({ length: users }, (_, i) => runUser(store, i)));
  const swept = reconcileSweep(store);

  const orders = [...store.orders.values()];
  const paidOrders = orders.filter((o) => o.status === "PAID");

  // Duplicate shipments / emails.
  let dupShipments = 0;
  for (const o of paidOrders) {
    if ((store.shipmentsCreated.get(o.id) ?? 0) > 1) dupShipments++;
  }
  let dupEmails = 0;
  for (const [, n] of store.emailsSent) if (n > 1) dupEmails++;

  // Paid orders that never got a shipment.
  const paidWithoutShipment = paidOrders.filter(
    (o) => (store.shipmentsCreated.get(o.id) ?? 0) === 0,
  ).length;

  // Stock conservation: final stock must equal initial minus units still held
  // by PAID orders (everything else was released).
  const heldByPaid = paidOrders.reduce((s, o) => s + o.units, 0);
  const stockConserved = store.stock === store.initialStock - heldByPaid;

  // Coupon conservation: used count must equal coupons held by PAID orders.
  const couponHeldByPaid = paidOrders.filter((o) => o.couponId).length;
  const couponConserved = store.coupon.used === couponHeldByPaid;

  // No lost orders: every created order ended in a terminal state.
  const lostOrders = orders.filter(
    (o) => !["PAID", "FAILED", "ABANDONED"].includes(o.status),
  ).length;

  void swept;
  return {
    users,
    created: orders.length,
    paid: paidOrders.length,
    soldOut: users - orders.length,
    finalStock: store.stock,
    oversold: store.oversellDetected || store.stock < 0,
    dupShipments,
    dupEmails,
    paidWithoutShipment,
    stockConserved,
    couponConserved,
    lostOrders,
  };
}

function pass(b: boolean): string {
  return b ? "PASS" : "FAIL";
}

async function main() {
  const scenarios = [100, 500, 1000];
  const results: Result[] = [];
  for (const n of scenarios) results.push(await simulate(n));

  console.log("\n=== SURGE SIMULATION RESULTS ===\n");
  for (const r of results) {
    console.log(`── ${r.users} concurrent users ──────────────────────────`);
    console.log(`  orders created          : ${r.created}`);
    console.log(`  paid                    : ${r.paid}`);
    console.log(`  cleanly rejected (stock): ${r.soldOut}`);
    console.log(`  final stock             : ${r.finalStock}`);
    console.log(`  No overselling          : ${pass(!r.oversold)}`);
    console.log(`  No duplicate shipments  : ${pass(r.dupShipments === 0)} (${r.dupShipments} dups)`);
    console.log(`  No duplicate emails     : ${pass(r.dupEmails === 0)} (${r.dupEmails} dups)`);
    console.log(`  No stuck paid orders    : ${pass(r.paidWithoutShipment === 0)} (${r.paidWithoutShipment} stuck)`);
    console.log(`  No lost orders          : ${pass(r.lostOrders === 0)}`);
    console.log(`  Stock conserved         : ${pass(r.stockConserved)}`);
    console.log(`  Coupon usage conserved  : ${pass(r.couponConserved)}`);
    console.log("");
  }

  const allPass = results.every(
    (r) =>
      !r.oversold &&
      r.dupShipments === 0 &&
      r.dupEmails === 0 &&
      r.paidWithoutShipment === 0 &&
      r.lostOrders === 0 &&
      r.stockConserved &&
      r.couponConserved,
  );
  console.log(`OVERALL: ${allPass ? "ALL INVARIANTS HOLD ✅" : "INVARIANT VIOLATION ❌"}`);
  process.exit(allPass ? 0 : 1);
}

main();
