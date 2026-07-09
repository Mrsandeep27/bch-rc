/**
 * GET /api/admin/export?dataset=orders|funnel|customers[&days=N]
 *
 * Admin-only CSV export of the datasets you actually study the audience from:
 * paid/placed ORDERS (who bought, from where, how they paid, what), raw FUNNEL
 * EVENTS (every step a visitor took, where they dropped off), and the CUSTOMERS
 * CRM list (name, phone, email + site-scoped orders/spend/last-order).
 *
 * The point: the source code contains zero audience data. This route is the
 * "data out" half — download a CSV here, hand it to Claude (or open in Excel),
 * and you can actually analyse the audience. Nothing here lives in the repo.
 *
 * Auth: getAdminContext() (NOT requireAdmin — that redirects, which is wrong
 * for a fetch/download). Null context → 401, never a redirect.
 *
 * No BOM is written: the primary consumer is AI/pandas analysis, where a
 * BOM-prefixed first header ("﻿order_id") silently breaks column lookups.
 * Amounts are plain integers (rupees), so there's no ₹ glyph needing a BOM.
 */

import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { orders, customers, funnelEvents } from "@/db/schema";
import { getAdminContext } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

// Hard caps so a runaway export can't try to stream the whole table into
// memory. Orders are low-volume (keep all); funnel events are high-volume.
const ORDERS_MAX = 50_000;
const FUNNEL_MAX = 100_000;
const CUSTOMERS_MAX = 100_000;

/** RFC-4180 cell: stringify, then quote+escape only when needed. */
function csvCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  let s: string;
  if (v instanceof Date) s = v.toISOString();
  else if (typeof v === "object") s = JSON.stringify(v);
  else s = String(v);
  if (/[",\r\n]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers.join(",")];
  for (const r of rows) lines.push(r.map(csvCell).join(","));
  return lines.join("\r\n");
}

/** Pull a field from a JSONB snapshot defensively (shape can drift over time). */
function field(obj: unknown, key: string): unknown {
  if (obj && typeof obj === "object") {
    return (obj as Record<string, unknown>)[key];
  }
  return undefined;
}

async function exportOrders(
  sinceDays: number | null,
  siteIds: string[],
): Promise<string> {
  const where = sinceDays
    ? and(
        inArray(orders.siteId, siteIds),
        gte(orders.placedAt, new Date(Date.now() - sinceDays * 86_400_000)),
      )
    : inArray(orders.siteId, siteIds);

  const rows = await db
    .select({ o: orders, c: customers })
    .from(orders)
    .leftJoin(customers, eq(orders.customerId, customers.id))
    .where(where)
    .orderBy(desc(orders.placedAt))
    .limit(ORDERS_MAX);

  const headers = [
    "order_id",
    "placed_at",
    "paid_at",
    "status",
    "payment_status",
    "payment_method",
    "created_via",
    "customer_name",
    "customer_phone",
    "customer_email",
    "city",
    "state",
    "pincode",
    "item_count",
    "items",
    "subtotal_inr",
    "shipping_inr",
    "cod_fee_inr",
    "discount_inr",
    "total_inr",
    "coupon_code",
    "source",
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "referrer_host",
    "customer_total_orders",
    "customer_total_spent_inr",
  ];

  const data = rows.map(({ o, c }) => {
    const items = Array.isArray(o.items) ? o.items : [];
    const itemCount = items.reduce(
      (n: number, it: unknown) => n + (Number(field(it, "qty")) || 0),
      0,
    );
    const itemsSummary = items
      .map((it) => `${field(it, "skuId") ?? "?"}×${field(it, "qty") ?? "?"}`)
      .join("; ");
    const addr = o.shippingAddress;
    return [
      o.id,
      o.placedAt,
      o.paidAt,
      o.status,
      o.paymentStatus,
      o.paymentMethod,
      o.createdVia,
      field(addr, "fullName") ?? c?.name ?? "",
      field(addr, "phone") ?? c?.phone ?? "",
      field(addr, "email") ?? c?.email ?? "",
      field(addr, "city"),
      field(addr, "state"),
      field(addr, "pincode"),
      itemCount,
      itemsSummary,
      o.subtotalInr,
      o.shippingInr,
      o.codFeeInr,
      o.discountInr,
      o.totalInr,
      o.couponCode,
      o.source,
      o.utmSource,
      o.utmMedium,
      o.utmCampaign,
      o.referrerHost,
      c?.totalOrders ?? "",
      c?.totalSpentInr ?? "",
    ];
  });

  return toCsv(headers, data);
}

async function exportFunnel(
  sinceDays: number,
  siteIds: string[],
): Promise<string> {
  const rows = await db
    .select()
    .from(funnelEvents)
    .where(
      and(
        inArray(funnelEvents.siteId, siteIds),
        gte(
          funnelEvents.createdAt,
          new Date(Date.now() - sinceDays * 86_400_000),
        ),
      ),
    )
    .orderBy(desc(funnelEvents.createdAt))
    .limit(FUNNEL_MAX);

  const headers = [
    "created_at",
    "type",
    "path",
    "session_id",
    "visitor_id",
    "order_id",
    "is_bot",
    "metadata",
  ];

  const data = rows.map((e) => [
    e.createdAt,
    e.type,
    e.path,
    e.sessionId,
    e.visitorId,
    e.orderId,
    e.isBot,
    e.metadata,
  ]);

  return toCsv(headers, data);
}

async function exportCustomers(siteIds: string[]): Promise<string> {
  // Site-scoped CRM export. Orders are joined only for the operator's sites, so
  // the order count / spend / last-order columns reflect what this admin can
  // see — never cross-site totals. A customer is included when they have at
  // least one order in scope OR their first_site_id is one of these sites.
  const rows = await db
    .select({
      name: customers.name,
      phone: customers.phone,
      email: customers.email,
      orderCount: sql<number>`count(${orders.id})::int`,
      revenue: sql<number>`coalesce(sum(${orders.totalInr}), 0)::int`,
      lastOrder: sql<Date | null>`max(${orders.placedAt})`,
    })
    .from(customers)
    .leftJoin(
      orders,
      sql`${orders.customerId} = ${customers.id} AND ${inArray(orders.siteId, siteIds)}`,
    )
    .groupBy(customers.id)
    .having(
      sql`count(${orders.id}) > 0 OR ${inArray(customers.firstSiteId, siteIds)}`,
    )
    .orderBy(sql`coalesce(sum(${orders.totalInr}), 0) desc`)
    .limit(CUSTOMERS_MAX);

  const headers = [
    "name",
    "phone",
    "email",
    "total_orders",
    "total_spent_inr",
    "last_order",
  ];

  const data = rows.map((c) => [
    c.name,
    c.phone,
    c.email,
    c.orderCount,
    c.revenue,
    c.lastOrder,
  ]);

  return toCsv(headers, data);
}

export async function GET(req: NextRequest) {
  const ctx = await getAdminContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dataset = req.nextUrl.searchParams.get("dataset");
  const daysRaw = req.nextUrl.searchParams.get("days");
  const days = daysRaw ? Math.min(Math.max(Number(daysRaw) || 0, 1), 365) : null;

  // Export covers the admin's stores. ?site=<id> narrows to one (validated
  // against the admin's sites so it can't widen access); default = all of them.
  const siteParam = req.nextUrl.searchParams.get("site");
  const siteIds =
    siteParam && ctx.siteIds.includes(siteParam) ? [siteParam] : ctx.siteIds;

  let csv: string;
  let name: string;
  if (dataset === "orders") {
    csv = await exportOrders(days, siteIds);
    name = "orders";
  } else if (dataset === "funnel") {
    // Funnel is high-volume — always windowed. Default 30 days.
    csv = await exportFunnel(days ?? 30, siteIds);
    name = "funnel-events";
  } else if (dataset === "customers") {
    csv = await exportCustomers(siteIds);
    name = "customers";
  } else {
    return NextResponse.json(
      { error: "dataset must be 'orders', 'funnel', or 'customers'" },
      { status: 400 },
    );
  }

  const stamp = new Date().toISOString().slice(0, 10);
  const suffix = days ? `-${days}d` : "";
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="prc-${name}${suffix}-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
