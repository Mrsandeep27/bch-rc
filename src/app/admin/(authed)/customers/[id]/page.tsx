import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Mail, MapPin, Phone } from "lucide-react";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { customers, orders } from "@/db/schema";
import { requireAdmin } from "@/lib/admin-auth";
import { formatINR } from "@/lib/utils";
import { waLink } from "@/lib/config";

type ShippingAddr = {
  fullName?: string;
  email?: string | null;
  phone?: string | null;
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  pincode?: string;
};

function addrKey(a: ShippingAddr): string {
  return [a.line1, a.line2, a.city, a.state, a.pincode]
    .filter(Boolean)
    .map((s) => s!.trim().toLowerCase())
    .join("|");
}

function addrLines(a: ShippingAddr): string[] {
  return [
    a.line1,
    a.line2,
    [a.city, a.state, a.pincode].filter(Boolean).join(", "),
  ].filter((s): s is string => Boolean(s && s.trim()));
}

export default async function AdminCustomerDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await requireAdmin();
  const { id } = await params;

  const [customer] = await db
    .select()
    .from(customers)
    .where(eq(customers.id, id));

  if (!customer) notFound();

  // Pull every order the customer placed within sites the admin can see.
  // No site filter on the customer row itself (customers are global by
  // phone), but orders are site-scoped — only show those the operator
  // is allowed to view.
  const customerOrders = await db
    .select()
    .from(orders)
    .where(
      and(eq(orders.customerId, id), inArray(orders.siteId, ctx.siteIds)),
    )
    .orderBy(desc(orders.placedAt));

  // Derived stats from the orders this admin can see (not the denormalised
  // counters on the customer row, which span sites the admin can't).
  const visibleOrderCount = customerOrders.length;
  const visibleRevenue = customerOrders.reduce(
    (sum, o) => sum + o.totalInr,
    0,
  );
  const paidOrders = customerOrders.filter((o) =>
    ["PAID", "PACKED", "SHIPPED", "DELIVERED"].includes(o.status),
  );
  const aov =
    paidOrders.length > 0
      ? Math.round(
          paidOrders.reduce((s, o) => s + o.totalInr, 0) / paidOrders.length,
        )
      : 0;

  const firstOrder = customerOrders[customerOrders.length - 1];
  const lastOrder = customerOrders[0];
  const daysSinceLast = lastOrder
    ? Math.floor(
        (Date.now() - new Date(lastOrder.placedAt).getTime()) /
          (1000 * 60 * 60 * 24),
      )
    : null;

  // Dedupe shipping addresses across this customer's orders, keep insert
  // order so the most-recent shows first.
  const addrSeen = new Set<string>();
  const uniqueAddrs: ShippingAddr[] = [];
  for (const o of customerOrders) {
    const a = o.shippingAddress as ShippingAddr;
    const key = addrKey(a);
    if (!key || addrSeen.has(key)) continue;
    addrSeen.add(key);
    uniqueAddrs.push(a);
  }

  return (
    <div className="space-y-5">
      <Link
        href="/admin/customers"
        className="inline-flex items-center gap-1 text-sm text-brand-ink-soft hover:text-brand-ink"
      >
        <ChevronLeft size={16} />
        All customers
      </Link>

      {/* Identity header */}
      <div className="bg-white rounded-2xl border border-brand-line p-5">
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-brand-ink">
          {customer.name ?? "Anonymous customer"}
        </h1>
        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
          {customer.phone && (
            <a
              href={`tel:+91${customer.phone}`}
              className="inline-flex items-center gap-1.5 text-brand-ink-soft hover:text-brand-ink"
            >
              <Phone size={14} />
              <span className="font-mono">+91 {customer.phone}</span>
            </a>
          )}
          {customer.phone && (
            <a
              href={waLink(customer.phone, "")}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-success hover:underline"
            >
              WhatsApp
            </a>
          )}
          {customer.email && (
            <a
              href={`mailto:${customer.email}`}
              className="inline-flex items-center gap-1.5 text-brand-ink-soft hover:text-brand-ink"
            >
              <Mail size={14} />
              <span>{customer.email}</span>
            </a>
          )}
        </div>
        {customer.createdAt && (
          <p className="text-xs text-brand-ink-soft font-mono uppercase tracking-widest mt-3">
            Customer since{" "}
            {new Date(customer.createdAt).toLocaleDateString("en-IN", {
              dateStyle: "medium",
            })}
          </p>
        )}
      </div>

      {/* LTV stats — derived from orders the admin can see */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Orders" value={visibleOrderCount} />
        <Stat label="Lifetime" value={formatINR(visibleRevenue)} />
        <Stat label="AOV (paid)" value={formatINR(aov)} />
        <Stat
          label="Last order"
          value={
            daysSinceLast === null
              ? "—"
              : daysSinceLast === 0
                ? "Today"
                : `${daysSinceLast}d ago`
          }
        />
      </div>

      {/* Addresses used */}
      <section className="bg-white rounded-2xl border border-brand-line">
        <header className="px-5 py-4 border-b border-brand-line">
          <h2 className="font-semibold text-brand-ink">
            Shipping addresses{" "}
            <span className="text-brand-ink-soft font-normal">
              — {uniqueAddrs.length} unique
            </span>
          </h2>
        </header>
        {uniqueAddrs.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-brand-ink-soft">
            No addresses on file yet.
          </p>
        ) : (
          <ul className="divide-y divide-brand-line">
            {uniqueAddrs.map((a, i) => (
              <li
                key={`${addrKey(a)}-${i}`}
                className="px-5 py-3 flex items-start gap-3"
              >
                <MapPin
                  size={16}
                  className="text-brand-ink-soft shrink-0 mt-0.5"
                />
                <div className="text-sm text-brand-ink space-y-0.5">
                  {addrLines(a).map((line, idx) => (
                    <div key={idx}>{line}</div>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Order history */}
      <section className="bg-white rounded-2xl border border-brand-line">
        <header className="px-5 py-4 border-b border-brand-line">
          <h2 className="font-semibold text-brand-ink">
            Order history{" "}
            <span className="text-brand-ink-soft font-normal">
              — {customerOrders.length}
            </span>
          </h2>
        </header>
        {customerOrders.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-brand-ink-soft">
            No orders yet.
          </p>
        ) : (
          <ul className="divide-y divide-brand-line">
            {customerOrders.map((o) => (
              <li key={o.id}>
                <Link
                  href={`/admin/orders/${o.id}`}
                  className="flex items-start gap-4 px-5 py-3 hover:bg-brand-cream transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-semibold text-brand-ink">
                        {o.id}
                      </span>
                      <StatusBadge status={o.status} />
                    </div>
                    <div className="text-xs text-brand-ink-soft mt-1">
                      {new Date(o.placedAt).toLocaleString("en-IN", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                      {" · "}
                      {o.paymentMethod}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-semibold text-brand-ink tabular-nums">
                      {formatINR(o.totalInr)}
                    </div>
                    {o.awbCode && (
                      <div className="text-[10px] font-mono text-brand-ink-soft mt-0.5">
                        AWB {o.awbCode}
                      </div>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {firstOrder && (
        <p className="text-xs text-brand-ink-soft text-center">
          First order on{" "}
          {new Date(firstOrder.placedAt).toLocaleDateString("en-IN", {
            dateStyle: "medium",
          })}
        </p>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="bg-white rounded-2xl border border-brand-line p-4">
      <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-brand-ink-soft">
        {label}
      </p>
      <p className="font-display text-xl font-bold text-brand-ink mt-1.5 tabular-nums">
        {value}
      </p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    PENDING: "bg-gold/10 text-gold",
    PAID: "bg-success/10 text-success",
    PACKED: "bg-success/10 text-success",
    SHIPPED: "bg-blue-100 text-blue-700",
    DELIVERED: "bg-success/15 text-success",
    CANCELLED: "bg-brand-red/10 text-brand-red",
    REFUNDED: "bg-brand-red/10 text-brand-red",
    FAILED: "bg-brand-red/10 text-brand-red",
    ABANDONED: "bg-brand-ink-soft/10 text-brand-ink-soft",
    RETURNED: "bg-brand-red/10 text-brand-red",
  };
  return (
    <span
      className={`${styles[status] ?? "bg-brand-line text-brand-ink"} text-[10px] font-mono uppercase tracking-widest font-semibold px-2 py-0.5 rounded-full`}
    >
      {status}
    </span>
  );
}
