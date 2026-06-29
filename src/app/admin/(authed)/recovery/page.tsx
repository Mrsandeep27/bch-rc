import { and, desc, eq, gte, inArray, lt } from "drizzle-orm";
import { LifeBuoy, MessageCircle, Phone, Snowflake } from "lucide-react";
import { db } from "@/db";
import { orders, checkoutLeads } from "@/db/schema";
import { requireAdmin } from "@/lib/admin-auth";
import { formatINR } from "@/lib/utils";

export const dynamic = "force-dynamic";

// A cart is "recoverable" if an order row exists but never got paid:
//   PENDING   — UPI order created, payment never captured (still open / pre-sweep)
//   ABANDONED — reconcile sweep marked a stale PENDING dead (modal closed, lost net)
//   FAILED    — Razorpay payment.failed: the UPI attempt timed out or was declined.
//               This is the HOTTEST lead — they actively tried to pay — yet it was
//               previously excluded, so "payment timed out" orders never surfaced here.
// PENDING_COD_VERIFICATION is a different (manual) queue, not here. CANCELLED /
// RETURNED / REFUNDED are deliberate exits, not recoverable, so they stay out.
const RECOVERABLE = ["PENDING", "ABANDONED", "FAILED"] as const;
const PAID = ["PAID", "PACKED", "SHIPPED", "DELIVERED"] as const;

// Don't show carts younger than this — the customer may still be mid-checkout.
const MIN_AGE_MIN = 30;
// Carts up to this age are "hot" — the lead is fresh and worth a nudge/call.
const FRESH_DAYS = 14;
// Older than FRESH_DAYS up to this bound = "cold lead" — still callable, lower
// odds. Past this we stop showing them (genuinely stale).
const COLD_DAYS = 90;

type Addr = { fullName?: string; phone?: string; city?: string; state?: string };
type Item = { skuId?: string; name?: string; qty?: number };
type Cart = {
  id: string;
  // "order" = a created-but-unpaid order. "lead" = a step-1 detail capture
  // (customer entered contact + address but never reached payment).
  kind: "order" | "lead";
  status: string;
  items: unknown;
  shippingAddress: unknown;
  totalInr: number;
  paymentMethod: string;
  source: string;
  customerId: string;
  placedAt: Date;
};

function ageLabel(d: Date, nowMs: number): string {
  const mins = Math.floor((nowMs - d.getTime()) / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

/** Normalise a stored 10-digit Indian number to +91 E.164 (for wa.me / tel:). */
function e164(phone: string): string {
  const digits = phone.replace(/\D/g, "").replace(/^0+/, "");
  return digits.length === 10 ? `91${digits}` : digits;
}

/** WhatsApp deep link to the CUSTOMER (not the store) with a recovery nudge.
 *  `kind` tailors the copy: an order-cart got as far as a payment attempt; a
 *  lead only filled their details and never reached payment. */
function recoveryWaLink(
  phone: string,
  name: string,
  ref: string,
  totalInr: number,
  kind: "order" | "lead",
): string {
  const first = (name || "there").split(" ")[0];
  const msg =
    kind === "lead"
      ? `Hi ${first}! This is Pocket RC Cars 🏎️ — you were ordering with us ` +
        `(${formatINR(totalInr)}) but didn't finish. Want me to help you ` +
        `complete it? You can pay online or Cash on Delivery, whichever is ` +
        `easier. Just reply here 🙂`
      : `Hi ${first}! This is Pocket RC Cars 🏎️ — you started an order ` +
        `(${ref}) for ${formatINR(totalInr)} but the payment didn't go ` +
        `through. Want me to help you finish it? You can also pay Cash on ` +
        `Delivery if that's easier. Just reply here 🙂`;
  return `https://wa.me/${e164(phone)}?text=${encodeURIComponent(msg)}`;
}

export default async function RecoveryPage() {
  const ctx = await requireAdmin();

  const nowMs = new Date().getTime();
  const since = new Date(nowMs - COLD_DAYS * 86_400_000);
  const until = new Date(nowMs - MIN_AGE_MIN * 60_000);
  const freshCutoff = nowMs - FRESH_DAYS * 86_400_000;

  const [carts, paidRows] = await Promise.all([
    db
      .select({
        id: orders.id,
        status: orders.status,
        items: orders.items,
        shippingAddress: orders.shippingAddress,
        totalInr: orders.totalInr,
        paymentMethod: orders.paymentMethod,
        source: orders.source,
        customerId: orders.customerId,
        placedAt: orders.placedAt,
      })
      .from(orders)
      .where(
        and(
          inArray(orders.siteId, ctx.siteIds),
          inArray(orders.status, [...RECOVERABLE]),
          gte(orders.placedAt, since),
          lt(orders.placedAt, until),
        ),
      )
      .orderBy(desc(orders.placedAt))
      .limit(500),
    // Customers who DID pay in the window — exclude their abandoned attempts so
    // we never nudge someone who already bought (they retried and succeeded).
    db
      .selectDistinct({ customerId: orders.customerId })
      .from(orders)
      .where(
        and(
          inArray(orders.siteId, ctx.siteIds),
          inArray(orders.status, [...PAID]),
          gte(orders.placedAt, since),
        ),
      ),
  ]);

  const paidSet = new Set(paidRows.map((r) => r.customerId));

  // Step-1 leads: customers who entered their details but never reached the
  // payment step (no order row was ever created). status stays OPEN until they
  // create any order, at which point order/create flips it to CONVERTED — so an
  // OPEN lead means "filled details, never paid". Same age window as carts.
  //
  // Wrapped defensively: if the checkout_leads migration (0016) hasn't been
  // applied to this environment yet, treat it as "no leads" rather than hard-
  // failing the whole recovery page. Lets the code deploy ahead of the
  // migration safely.
  type LeadRow = {
    id: string;
    items: unknown;
    fullName: string | null;
    phone: string | null;
    city: string | null;
    state: string | null;
    subtotalInr: number;
    customerId: string;
    createdAt: Date;
  };
  let leadRows: LeadRow[] = [];
  try {
    leadRows = (await db
      .select({
        id: checkoutLeads.id,
        items: checkoutLeads.items,
        fullName: checkoutLeads.fullName,
        phone: checkoutLeads.phone,
        city: checkoutLeads.city,
        state: checkoutLeads.state,
        subtotalInr: checkoutLeads.subtotalInr,
        customerId: checkoutLeads.customerId,
        createdAt: checkoutLeads.createdAt,
      })
      .from(checkoutLeads)
      .where(
        and(
          inArray(checkoutLeads.siteId, ctx.siteIds),
          eq(checkoutLeads.status, "OPEN"),
          gte(checkoutLeads.createdAt, since),
          lt(checkoutLeads.createdAt, until),
        ),
      )
      .orderBy(desc(checkoutLeads.createdAt))
      .limit(500)) as LeadRow[];
  } catch {
    leadRows = [];
  }

  // Normalise leads to the same shape as order-carts so they render in one list.
  const leadCarts: Cart[] = leadRows.map((l) => ({
    id: l.id,
    kind: "lead",
    status: "OPEN",
    items: l.items,
    shippingAddress: {
      fullName: l.fullName ?? undefined,
      phone: l.phone ?? undefined,
      city: l.city ?? undefined,
      state: l.state ?? undefined,
    },
    totalInr: l.subtotalInr,
    paymentMethod: "",
    source: "web",
    customerId: l.customerId,
    placedAt: l.createdAt,
  }));

  // Merge order-carts (richer, take precedence) ahead of leads, newest first.
  // An order row already covers a customer who reached payment, so when the
  // same customer also has a lead the order row wins the per-customer dedup.
  const merged = [
    ...(carts as Omit<Cart, "kind">[]).map((c) => ({ ...c, kind: "order" as const })),
    ...leadCarts,
  ].sort((a, b) => b.placedAt.getTime() - a.placedAt.getTime());

  // Show a lead only if they NEVER succeeded, and only ONCE — their latest
  // unpaid attempt. `merged` is ordered by placedAt desc, so the first row we
  // see per customer is the most recent; later (older) retries are collapsed.
  // Net effect: a FAILED order appears only if the customer hasn't paid and
  // hasn't already been listed via a newer attempt.
  const seenCustomer = new Set<string>();
  const recoverable = merged.filter((c) => {
    if (paidSet.has(c.customerId)) return false;
    const key = c.customerId ?? c.id;
    if (seenCustomer.has(key)) return false;
    seenCustomer.add(key);
    return true;
  });
  const fresh = recoverable.filter((c) => c.placedAt.getTime() >= freshCutoff);
  const cold = recoverable.filter((c) => c.placedAt.getTime() < freshCutoff);
  const freshValue = fresh.reduce((sum, c) => sum + c.totalInr, 0);
  const coldValue = cold.reduce((sum, c) => sum + c.totalInr, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-brand-ink flex items-center gap-2">
          <LifeBuoy size={24} className="text-brand-red" /> Cart recovery
        </h1>
        <p className="text-sm text-brand-ink-soft mt-1">
          Orders created but never paid — plus customers who filled their
          details at checkout but never reached payment (tagged{" "}
          <span className="text-brand-red font-semibold">Didn&apos;t reach payment</span>)
          — each with one-tap Call + WhatsApp. Hides carts under {MIN_AGE_MIN}{" "}
          min old (still checking out) and customers who already paid since.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 max-w-md">
        <div className="bg-white rounded-2xl border border-brand-line p-5">
          <p className="text-xs font-mono font-bold uppercase tracking-widest text-brand-ink-soft">
            Hot carts (&lt;{FRESH_DAYS}d)
          </p>
          <p className="font-display text-3xl font-bold mt-2 text-brand-ink">
            {fresh.length}
          </p>
        </div>
        <div className="bg-white rounded-2xl border border-brand-line p-5">
          <p className="text-xs font-mono font-bold uppercase tracking-widest text-brand-ink-soft">
            Value at stake
          </p>
          <p className="font-display text-3xl font-bold mt-2 text-brand-ink">
            {formatINR(freshValue)}
          </p>
        </div>
      </div>

      {/* Hot leads */}
      <section className="bg-white rounded-2xl border border-brand-line">
        {fresh.length === 0 ? (
          <p className="px-5 py-12 text-center text-sm text-brand-ink-soft">
            No hot carts right now. 🎉
          </p>
        ) : (
          <ul className="divide-y divide-brand-line">
            {fresh.map((c) => (
              <CartRow key={c.id} c={c} nowMs={nowMs} />
            ))}
          </ul>
        )}
      </section>

      {/* Cold leads — older than FRESH_DAYS, lower odds but still callable */}
      {cold.length > 0 && (
        <section className="bg-white rounded-2xl border border-brand-line overflow-hidden">
          <header className="px-5 py-3 border-b border-brand-line bg-brand-cream flex items-center justify-between gap-3">
            <h2 className="font-semibold text-brand-ink flex items-center gap-2">
              <Snowflake size={16} className="text-brand-ink-soft" /> Cold leads{" "}
              <span className="text-brand-ink-soft font-normal text-sm">
                — {FRESH_DAYS}–{COLD_DAYS} days old
              </span>
            </h2>
            <span className="text-xs font-mono text-brand-ink-soft">
              {cold.length} · {formatINR(coldValue)}
            </span>
          </header>
          <ul className="divide-y divide-brand-line opacity-90">
            {cold.map((c) => (
              <CartRow key={c.id} c={c} nowMs={nowMs} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function CartRow({ c, nowMs }: { c: Cart; nowMs: number }) {
  const addr = (c.shippingAddress ?? {}) as Addr;
  const items = (c.items ?? []) as Item[];
  const itemSummary = items
    .map((i) => `${i.name ?? i.skuId} ×${i.qty ?? 1}`)
    .join(", ");
  const phone = addr.phone ?? "";

  const isLead = c.kind === "lead";

  return (
    <li className="flex flex-col sm:flex-row sm:items-center gap-3 px-5 py-4">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-brand-ink">
            {addr.fullName ?? "Unknown"}
          </span>
          {isLead ? (
            <span className="text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-brand-red-soft text-brand-red font-bold">
              Didn&apos;t reach payment
            </span>
          ) : (
            <>
              <span className="text-xs font-mono text-brand-ink-soft">{c.id}</span>
              <span className="text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-brand-cream text-brand-ink-soft">
                {c.paymentMethod} · {c.source}
              </span>
            </>
          )}
        </div>
        <div className="text-sm text-brand-ink-soft truncate mt-0.5">
          {itemSummary || "—"}
        </div>
        <div className="text-xs text-brand-ink-soft mt-0.5">
          {[addr.city, addr.state].filter(Boolean).join(", ")}
          {" · "}
          {ageLabel(c.placedAt, nowMs)}
          {phone ? ` · ${phone}` : " · no phone"}
        </div>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <span className="font-semibold text-brand-ink tabular-nums">
          {formatINR(c.totalInr)}
        </span>
        {phone ? (
          <>
            <a
              href={`tel:+${e164(phone)}`}
              className="inline-flex items-center gap-1.5 bg-white border border-brand-ink/15 hover:border-brand-ink text-brand-ink px-3 py-2 rounded-full text-sm font-semibold transition-colors"
            >
              <Phone size={14} /> Call
            </a>
            <a
              href={recoveryWaLink(phone, addr.fullName ?? "", c.id, c.totalInr, c.kind)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 bg-whatsapp-green hover:bg-whatsapp-green-hover text-white px-3 py-2 rounded-full text-sm font-semibold transition-colors"
            >
              <MessageCircle size={14} /> Nudge
            </a>
          </>
        ) : (
          <span className="text-xs text-brand-ink-soft">no phone</span>
        )}
      </div>
    </li>
  );
}
