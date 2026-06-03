import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { ChevronLeft, ExternalLink, MessageCircle } from "lucide-react";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { orders, customers, events } from "@/db/schema";
import { requireAdmin } from "@/lib/admin-auth";
import { formatINR } from "@/lib/utils";
import { waLink } from "@/lib/config";
import { ShipButton } from "./ShipButton";
import OrderActions from "./OrderActions";

type OrderItem = {
  skuId: string;
  variantSlug: string | null;
  name: string;
  image: string | null;
  unitPriceInr: number;
  qty: number;
  lineTotalInr: number;
};

export default async function AdminOrderDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await requireAdmin();
  const { id } = await params;

  const [order] = await db.select().from(orders).where(eq(orders.id, id));
  if (!order || !ctx.siteIds.includes(order.siteId)) notFound();

  const [customer] = await db
    .select()
    .from(customers)
    .where(eq(customers.id, order.customerId));

  const orderEvents = await db
    .select()
    .from(events)
    .where(eq(events.orderId, id))
    .orderBy(desc(events.createdAt));

  const items = order.items as OrderItem[];
  const addr = order.shippingAddress as Record<string, string>;

  return (
    <div className="space-y-5">
      <Link
        href="/admin/orders"
        className="inline-flex items-center gap-1 text-sm text-brand-ink-soft hover:text-brand-ink"
      >
        <ChevronLeft size={16} /> All orders
      </Link>

      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="text-xs font-mono uppercase tracking-widest text-brand-ink-soft">
            Order
          </p>
          <h1 className="font-display text-3xl font-bold text-brand-ink font-mono">
            {order.id}
          </h1>
          <p className="text-sm text-brand-ink-soft mt-1">
            Placed{" "}
            {new Date(order.placedAt).toLocaleString("en-IN", {
              dateStyle: "medium",
              timeStyle: "short",
            })}{" "}
            · Site: {order.siteId}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={order.status} />
          <span className="bg-brand-cream text-brand-ink text-[10px] font-mono uppercase tracking-widest font-semibold px-2.5 py-1 rounded-full border border-brand-line">
            {order.paymentMethod} · {order.paymentStatus}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Items + totals */}
        <div className="lg:col-span-2 space-y-5">
          <div className="bg-white rounded-2xl border border-brand-line p-5">
            <h2 className="font-semibold text-brand-ink mb-4">Items</h2>
            <ul className="space-y-3">
              {items.map((item, idx) => (
                <li
                  key={`${item.skuId}-${item.variantSlug ?? "default"}-${idx}`}
                  className="flex items-center gap-3"
                >
                  {item.image && (
                    <div className="relative w-14 h-14 shrink-0 rounded-lg overflow-hidden border border-brand-line bg-brand-cream">
                      <Image
                        src={item.image}
                        alt={item.name}
                        fill
                        sizes="56px"
                        className="object-cover"
                      />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-brand-ink">
                      {item.name}
                    </div>
                    <div className="text-xs text-brand-ink-soft mt-0.5">
                      SKU: {item.skuId}
                      {item.variantSlug ? ` · Variant: ${item.variantSlug}` : ""}
                      {" · Qty "}{item.qty} · {formatINR(item.unitPriceInr)}
                    </div>
                  </div>
                  <div className="font-semibold text-brand-ink tabular-nums">
                    {formatINR(item.lineTotalInr)}
                  </div>
                </li>
              ))}
            </ul>

            <div className="border-t border-brand-line mt-5 pt-4 space-y-1.5 text-sm text-brand-ink">
              <Row label="Subtotal" value={formatINR(order.subtotalInr)} />
              <Row
                label="Shipping"
                value={order.shippingInr === 0 ? "FREE" : formatINR(order.shippingInr)}
              />
              {order.codFeeInr > 0 && (
                <Row label="COD fee" value={formatINR(order.codFeeInr)} />
              )}
              {order.discountInr > 0 && (
                <Row
                  label="Prepaid discount"
                  value={`-${formatINR(order.discountInr)}`}
                  green
                />
              )}
              <div className="flex justify-between font-bold text-base text-brand-ink pt-2 border-t border-brand-line mt-2">
                <span>Total</span>
                <span>{formatINR(order.totalInr)}</span>
              </div>
            </div>
          </div>

          {/* Event timeline */}
          <div className="bg-white rounded-2xl border border-brand-line p-5">
            <h2 className="font-semibold text-brand-ink mb-3">Event log</h2>
            {orderEvents.length === 0 ? (
              <p className="text-sm text-brand-ink-soft">No events yet.</p>
            ) : (
              <ul className="space-y-2 text-xs">
                {orderEvents.map((e) => (
                  <li
                    key={e.id}
                    className="flex items-baseline gap-3 border-l-2 border-brand-line pl-3"
                  >
                    <span className="font-mono text-brand-ink-soft shrink-0">
                      {new Date(e.createdAt).toLocaleTimeString("en-IN", {
                        hour12: false,
                      })}
                    </span>
                    <span className="font-mono font-semibold text-brand-ink uppercase tracking-widest">
                      {e.type}
                    </span>
                    <span className="text-brand-ink-soft truncate">
                      {typeof e.payload === "object" && e.payload
                        ? JSON.stringify(e.payload).slice(0, 80)
                        : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Customer + shipping + actions */}
        <div className="space-y-5">
          {customer && (
            <div className="bg-white rounded-2xl border border-brand-line p-5">
              <h2 className="font-semibold text-brand-ink mb-3">Customer</h2>
              <div className="text-sm text-brand-ink space-y-1">
                <div className="font-semibold">
                  {customer.name ?? addr.fullName}
                </div>
                <div className="text-brand-ink-soft">{customer.phone}</div>
                {customer.email && (
                  <div className="text-brand-ink-soft">{customer.email}</div>
                )}
                <div className="text-xs text-brand-ink-soft mt-2">
                  {customer.totalOrders} orders ·{" "}
                  {formatINR(customer.totalSpentInr)} lifetime
                </div>
                <a
                  href={waLink(
                    `Hi ${customer.name ?? ""}, regarding your order ${order.id}:`,
                  )}
                  target="_blank"
                  rel="noopener"
                  className="mt-3 inline-flex items-center gap-1.5 text-sm text-whatsapp-green hover:text-whatsapp-green-hover font-semibold"
                >
                  <MessageCircle size={14} /> WhatsApp customer
                </a>
              </div>
            </div>
          )}

          <div className="bg-white rounded-2xl border border-brand-line p-5">
            <h2 className="font-semibold text-brand-ink mb-3">Shipping to</h2>
            <div className="text-sm text-brand-ink-soft leading-relaxed">
              {addr.fullName}
              <br />
              {addr.line1}
              {addr.line2 && (
                <>
                  <br />
                  {addr.line2}
                </>
              )}
              <br />
              {addr.city}, {addr.state} {addr.pincode}
              <br />
              {addr.phone}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-brand-line p-5">
            <h2 className="font-semibold text-brand-ink mb-3">Fulfillment</h2>
            <dl className="text-sm space-y-1.5">
              <Field label="Shiprocket order" value={order.shiprocketOrderId} />
              <Field label="AWB code" value={order.awbCode} mono />
              <Field label="Courier" value={order.courierName} />
              {order.trackingUrl && (
                <div className="pt-2">
                  <a
                    href={order.trackingUrl}
                    target="_blank"
                    rel="noopener"
                    className="inline-flex items-center gap-1.5 text-sm text-brand-red hover:underline font-semibold"
                  >
                    Courier tracking <ExternalLink size={12} />
                  </a>
                </div>
              )}
            </dl>
            {(order.status === "PAID" ||
              (order.status === "PACKED" && !order.awbCode)) && (
              <div className="pt-3 mt-3 border-t border-brand-line">
                <ShipButton
                  orderId={order.id}
                  hasShipment={!!order.shiprocketOrderId}
                />
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-brand-line p-5">
            <h2 className="font-semibold text-brand-ink mb-3">Payment</h2>
            <dl className="text-sm space-y-1.5">
              <Field label="Method" value={order.paymentMethod} />
              <Field label="Status" value={order.paymentStatus} />
              <Field
                label="Razorpay order"
                value={order.razorpayOrderId}
                mono
              />
              <Field
                label="Razorpay payment"
                value={order.razorpayPaymentId}
                mono
              />
            </dl>
          </div>

          <OrderActions
            orderId={order.id}
            initialNotes={order.notes}
            canRefund={
              !!order.razorpayPaymentId &&
              order.paymentStatus !== "REFUNDED" &&
              order.status !== "REFUNDED"
            }
            refundAmountLabel={formatINR(order.totalInr)}
          />
        </div>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  green,
}: {
  label: string;
  value: string;
  green?: boolean;
}) {
  return (
    <div
      className={`flex justify-between ${green ? "text-success" : ""}`}
    >
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

function Field({
  label,
  value,
  mono,
}: {
  label: string;
  value: string | null;
  mono?: boolean;
}) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-brand-ink-soft">{label}</dt>
      <dd
        className={`text-brand-ink text-right truncate ${mono ? "font-mono text-xs" : ""}`}
      >
        {value ?? "—"}
      </dd>
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
      className={`${styles[status] ?? "bg-brand-line text-brand-ink"} text-[10px] font-mono uppercase tracking-widest font-semibold px-2.5 py-1 rounded-full`}
    >
      {status}
    </span>
  );
}
