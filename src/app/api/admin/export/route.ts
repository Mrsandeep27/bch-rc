/**
 * GET /api/admin/export?dataset=orders|funnel[&days=N]
 *
 * Admin-only CSV export of the two datasets you actually study the audience
 * from: paid/placed ORDERS (who bought, from where, how they paid, what) and
 * raw FUNNEL EVENTS (every step a visitor took, where they dropped off).
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
import { and, desc, eq, gte } from "drizzle-orm";
import { db } from "@/db";
import { orders, customers, funnelEvents } from "@/db/schema";
import { getAdminContext } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

const SITE_ID = process.env.DEFAULT_SITE_ID ?? "prc";

// Hard caps so a runaway export can't try to stream the whole table into
// memory. Orders are low-volume (keep all); funnel events are high-volume.
const ORDERS_MAX = 50_000;
const FUNNEL_MAX = 100_000;

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

async function exportOrders(sinceDays: number | null): Promise<string> {
  const where = sinceDays
    ? and(
        eq(orders.siteId, SITE_ID),
        gte(orders.placedAt, new Date(Date.now() - sinceDays * 86_400_000)),
      )
    : eq(orders.siteId, SITE_ID);

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

async function exportFunnel(sinceDays: number): Promise<string> {
  const rows = await db
    .select()
    .from(funnelEvents)
    .where(
      and(
        eq(funnelEvents.siteId, SITE_ID),
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

export async function GET(req: NextRequest) {
  const ctx = await getAdminContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dataset = req.nextUrl.searchParams.get("dataset");
  const daysRaw = req.nextUrl.searchParams.get("days");
  const days = daysRaw ? Math.min(Math.max(Number(daysRaw) || 0, 1), 365) : null;

  let csv: string;
  let name: string;
  if (dataset === "orders") {
    csv = await exportOrders(days);
    name = "orders";
  } else if (dataset === "funnel") {
    // Funnel is high-volume — always windowed. Default 30 days.
    csv = await exportFunnel(days ?? 30);
    name = "funnel-events";
  } else {
    return NextResponse.json(
      { error: "dataset must be 'orders' or 'funnel'" },
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
