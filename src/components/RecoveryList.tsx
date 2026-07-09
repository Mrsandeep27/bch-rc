/**
 * Presentational recovery list — stats + hot carts + cold leads, each row with
 * one-tap Call + WhatsApp. Shared by /admin/recovery and the caller desk
 * (/desk/[token]) so both render identically. Pure server component; the data
 * is fetched by the caller via getRecoverableCarts().
 */

import { MessageCircle, Phone, Snowflake } from "lucide-react";
import {
  ageLabel,
  e164,
  recoveryWaLink,
  FRESH_DAYS,
  COLD_DAYS,
  type Addr,
  type Cart,
  type Item,
  type RecoveryData,
} from "@/lib/recovery";
import { formatINR } from "@/lib/utils";

export function RecoveryList({ data, nowMs }: { data: RecoveryData; nowMs: number }) {
  const { fresh, cold, freshValue, coldValue } = data;

  return (
    <div className="space-y-6">
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
