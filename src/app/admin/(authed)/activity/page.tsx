import Link from "next/link";
import { Activity } from "lucide-react";
import { and, desc, inArray, isNotNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { events } from "@/db/schema";
import { requireAdmin } from "@/lib/admin-auth";

// Lightweight visual grouping for event types — green = good thing happened,
// red = unhappy thing happened, gold = needs attention, slate = informational.
const TYPE_TONE: Record<string, "good" | "bad" | "warn" | "info"> = {
  ORDER_CREATED: "info",
  PAYMENT_CAPTURED: "good",
  PAYMENT_FAILED: "bad",
  ORDER_CONFIRMED: "good",
  ORDER_SHIPPED: "good",
  ORDER_DELIVERED: "good",
  SHIPMENT_CREATED: "good",
  OUT_FOR_DELIVERY: "good",
  DELIVERED: "good",
  CANCELLED: "bad",
  REFUND_INITIATED: "bad",
  REFUND_PROCESSED: "bad",
  RETURNED: "bad",
  ABANDONED: "warn",
  ADMIN_NOTE_SAVED: "info",
  WEBHOOK_RECEIVED: "info",
};

function toneClasses(tone: "good" | "bad" | "warn" | "info"): string {
  switch (tone) {
    case "good":
      return "bg-success/10 text-success";
    case "bad":
      return "bg-brand-red/10 text-brand-red";
    case "warn":
      return "bg-gold/10 text-gold";
    default:
      return "bg-brand-cream text-brand-ink-soft";
  }
}

// Payload preview — render the JSONB as a single line (no newlines, length
// capped) so a row stays scannable. Falls back to "—" for empty payloads.
function summarisePayload(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "—";
  const entries = Object.entries(payload as Record<string, unknown>);
  if (entries.length === 0) return "—";
  return entries
    .map(([k, v]) => {
      const valStr =
        typeof v === "string"
          ? v
          : typeof v === "object"
            ? JSON.stringify(v)
            : String(v);
      return `${k}=${valStr.slice(0, 60)}`;
    })
    .join(" · ")
    .slice(0, 200);
}

export default async function AdminActivity({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const ctx = await requireAdmin();
  const params = await searchParams;
  const filterType = params.type?.trim();

  // Pull last 200 events across the admin's sites. We DON'T limit to events
  // with a site_id — some events (webhook receipts, cron heartbeats) are
  // global — so we use OR rather than AND for the site filter.
  const conditions = [
    sql`(${events.siteId} IS NULL OR ${inArray(events.siteId, ctx.siteIds)})`,
  ];
  if (filterType) conditions.push(sql`${events.type} = ${filterType}`);

  const [rows, typeBreakdown] = await Promise.all([
    db
      .select()
      .from(events)
      .where(and(...conditions))
      .orderBy(desc(events.createdAt))
      .limit(200),
    db
      .select({
        type: events.type,
        count: sql<number>`count(*)::int`,
      })
      .from(events)
      .where(
        sql`${events.siteId} IS NULL OR ${inArray(events.siteId, ctx.siteIds)}`,
      )
      .groupBy(events.type)
      .orderBy(desc(sql<number>`count(*)::int`))
      .limit(12),
  ]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-brand-ink inline-flex items-center gap-2">
          <Activity size={24} className="text-brand-red" />
          Activity
        </h1>
        <p className="text-sm text-brand-ink-soft mt-1">
          System + admin events across your sites. Latest 200 shown.
        </p>
      </div>

      {/* Type filter chips */}
      <div className="flex items-center gap-2 overflow-x-auto overflow-y-hidden no-scrollbar">
        <Chip
          href="/admin/activity"
          label="All types"
          count={typeBreakdown.reduce((s, r) => s + r.count, 0)}
          active={!filterType}
        />
        {typeBreakdown.map((t) => (
          <Chip
            key={t.type}
            href={`/admin/activity?type=${encodeURIComponent(t.type)}`}
            label={t.type}
            count={t.count}
            active={filterType === t.type}
          />
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-brand-line overflow-hidden">
        {rows.length === 0 ? (
          <p className="px-5 py-12 text-center text-sm text-brand-ink-soft">
            {filterType
              ? `No ${filterType} events yet.`
              : "No events recorded yet. They'll appear here as customers buy and the system reacts."}
          </p>
        ) : (
          <ul className="divide-y divide-brand-line">
            {rows.map((e) => {
              const tone = TYPE_TONE[e.type] ?? "info";
              const inner = (
                <div className="flex items-start gap-3 px-5 py-3">
                  <span
                    className={`shrink-0 mt-0.5 text-[10px] font-mono uppercase tracking-widest font-semibold px-2 py-0.5 rounded-full ${toneClasses(tone)}`}
                  >
                    {e.type}
                  </span>
                  <div className="flex-1 min-w-0">
                    {e.orderId && (
                      <span className="font-mono text-xs text-brand-ink-soft">
                        {e.orderId}
                      </span>
                    )}
                    <p className="text-xs text-brand-ink-soft truncate mt-0.5">
                      {summarisePayload(e.payload)}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-xs text-brand-ink-soft font-mono tabular-nums">
                      {new Date(e.createdAt).toLocaleString("en-IN", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </div>
                    {e.source && (
                      <div className="text-[10px] font-mono uppercase tracking-widest text-brand-ink-soft mt-0.5">
                        via {e.source}
                      </div>
                    )}
                  </div>
                </div>
              );
              return (
                <li key={e.id}>
                  {e.orderId ? (
                    <Link
                      href={`/admin/orders/${e.orderId}`}
                      className="block hover:bg-brand-cream transition-colors"
                    >
                      {inner}
                    </Link>
                  ) : (
                    inner
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <p className="text-xs text-brand-ink-soft text-center">
        Showing {rows.length} most recent events.
        {rows.length === 200 && " Older events kept in DB — surface a date range filter when you need it."}
      </p>
    </div>
  );
}

function Chip({
  href,
  label,
  count,
  active,
}: {
  href: string;
  label: string;
  count: number;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
        active
          ? "bg-brand-ink text-white"
          : "bg-white border border-brand-line text-brand-ink-soft hover:text-brand-ink"
      }`}
    >
      {label}
      <span
        className={`tabular-nums ${active ? "text-white/70" : "text-brand-ink-soft"}`}
      >
        {count}
      </span>
    </Link>
  );
}
