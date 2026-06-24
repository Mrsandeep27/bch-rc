import { and, desc, gte, inArray, lt } from "drizzle-orm";
import { LifeBuoy, MessageCircle, Phone } from "lucide-react";
import { db } from "@/db";
import { orders } from "@/db/schema";
import { requireAdmin } from "@/lib/admin-auth";
import { formatINR } from "@/lib/utils";

export const dynamic = "force-dynamic";

// A cart is "recoverable" if an order row exists but never got paid. We treat
// PENDING (UPI order created, never captured) and ABANDONED as the recoverable
// set. PENDING_COD_VERIFICATION is a different (manual) queue, not here.
const RECOVERABLE = ["PENDING", "ABANDONED"] as const;
const PAID = ["PAID", "PACKED", "SHIPPED", "DELIVERED"] as const;

// Don't show carts younger than this — the customer may still be mid-checkout.
const MIN_AGE_MIN = 30;
// Don't chase carts older than this — the lead is cold.
const MAX_AGE_DAYS = 14;

type Addr = { fullName?: string; phone?: string; city?: string; state?: string };
type Item = { skuId?: string; name?: string; qty?: number };

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

/** WhatsApp deep link to the CUSTOMER (not the store) with a recovery nudge. */
function recoveryWaLink(phone: string, name: string, orderId: string, totalInr: number): string {
  const first = (name || "there").split(" ")[0];
  const msg =
    `Hi ${first}! This is Pocket RC Cars 🏎️ — you started an order ` +
    `(${orderId}) for ${formatINR(totalInr)} but the payment didn't go ` +
    `through. Want me to help you finish it? You can also pay Cash on ` +
    `Delivery if that's easier. Just reply here 🙂`;
  return `https://wa.me/${e164(phone)}?text=${encodeURIComponent(msg)}`;
}

export default async function RecoveryPage() {
  const ctx = await requireAdmin();

  const nowMs = new Date().getTime();
  const since = new Date(nowMs - MAX_AGE_DAYS * 86_400_000);
  const until = new Date(nowMs - MIN_AGE_MIN * 60_000);

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
      .limit(200),
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
  const recoverable = carts.filter((c) => !paidSet.has(c.customerId));
  const valueAtStake = recoverable.reduce((sum, c) => sum + c.totalInr, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-brand-ink flex items-center gap-2">
          <LifeBuoy size={24} className="text-brand-red" /> Cart recovery
        </h1>
        <p className="text-sm text-brand-ink-soft mt-1">
          Orders that were created but never paid — with a one-tap WhatsApp
          nudge to the customer. Hides carts under {MIN_AGE_MIN} min old (still
          checking out) and customers who already paid since.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 max-w-md">
        <div className="bg-white rounded-2xl border border-brand-line p-5">
          <p className="text-xs font-mono font-bold uppercase tracking-widest text-brand-ink-soft">
            Recoverable carts
          </p>
          <p className="font-display text-3xl font-bold mt-2 text-brand-ink">
            {recoverable.length}
          </p>
        </div>
        <div className="bg-white rounded-2xl border border-brand-line p-5">
          <p className="text-xs font-mono font-bold uppercase tracking-widest text-brand-ink-soft">
            Value at stake
          </p>
          <p className="font-display text-3xl font-bold mt-2 text-brand-ink">
            {formatINR(valueAtStake)}
          </p>
        </div>
      </div>

      <section className="bg-white rounded-2xl border border-brand-line">
        {recoverable.length === 0 ? (
          <p className="px-5 py-12 text-center text-sm text-brand-ink-soft">
            No recoverable carts right now. 🎉
          </p>
        ) : (
          <ul className="divide-y divide-brand-line">
            {recoverable.map((c) => {
              const addr = (c.shippingAddress ?? {}) as Addr;
              const items = (c.items ?? []) as Item[];
              const itemSummary = items
                .map((i) => `${i.name ?? i.skuId} ×${i.qty ?? 1}`)
                .join(", ");
              const phone = addr.phone ?? "";
              return (
                <li
                  key={c.id}
                  className="flex flex-col sm:flex-row sm:items-center gap-3 px-5 py-4"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-brand-ink">
                        {addr.fullName ?? "Unknown"}
                      </span>
                      <span className="text-xs font-mono text-brand-ink-soft">
                        {c.id}
                      </span>
                      <span className="text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-brand-cream text-brand-ink-soft">
                        {c.paymentMethod} · {c.source}
                      </span>
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
                          href={recoveryWaLink(
                            phone,
                            addr.fullName ?? "",
                            c.id,
                            c.totalInr,
                          )}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 bg-whatsapp-green hover:bg-whatsapp-green-hover text-white px-3 py-2 rounded-full text-sm font-semibold transition-colors"
                        >
                          <MessageCircle size={14} /> Nudge
                        </a>
                      </>
                    ) : (
                      <span className="text-xs text-brand-ink-soft">
                        no phone
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
