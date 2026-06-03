/**
 * POST /api/orders/create
 *
 * The critical-path endpoint. In one transaction:
 *   1. UPSERT customer by phone
 *   2. INSERT address
 *   3. Validate each cart line against the products catalog AND verify the
 *      chosen variant is in stock
 *   4. Compute totals SERVER-SIDE (never trust client `total`)
 *   5. Redeem coupon atomically (used_count++ under the same transaction)
 *   6. INSERT orders row keyed on idempotency_key — duplicate submits return
 *      the original order without side effects
 *   7. For prepaid: create Razorpay order, save razorpay_order_id
 *      For COD: trigger Shiprocket shipment in-process (admin-gated route is
 *      reserved for manual admin retry)
 *   8. ENQUEUE order confirmation email (outbox row)
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { customers, addresses, orders, events } from "@/db/schema";
import { sql, eq } from "drizzle-orm";
import { PRODUCTS } from "@/lib/products";
import { OFFERS } from "@/lib/config";
import { razorpay } from "@/lib/razorpay";
import { generateOrderId } from "@/lib/order-id";
import { redeemCoupon, CouponError } from "@/lib/coupons";
import { triggerShipmentBackground } from "@/lib/fulfillment/create-shipment";
import { enqueueNotification } from "@/lib/notifications/enqueue";
import { sendOutboxRow } from "@/lib/notifications/drain";
import { logError } from "@/lib/logger";

const PaymentMethod = z.enum(["UPI", "CARD", "NETBANKING", "WALLET", "COD"]);

const CartItemInput = z.object({
  skuId: z.string().min(1).max(80),
  variantSlug: z.string().min(1).max(40).nullable(),
  qty: z.number().int().positive().max(20),
});

const AddressInput = z.object({
  fullName: z.string().min(2).max(120),
  phone: z.string().regex(/^[0-9]{10}$/, "10-digit phone required"),
  email: z.string().email("Valid email required").max(160),
  line1: z.string().min(3).max(200),
  line2: z.string().max(200).optional().or(z.literal("")),
  city: z.string().min(2).max(80),
  state: z.string().min(2).max(80),
  pincode: z.string().regex(/^[0-9]{6}$/, "6-digit pincode required"),
});

const BodySchema = z.object({
  siteId: z.string().min(1).max(40).default("prc"),
  idempotencyKey: z.string().min(8).max(64),
  items: z.array(CartItemInput).min(1).max(20),
  address: AddressInput,
  paymentMethod: PaymentMethod,
  couponCode: z.string().max(40).optional(),
});

type OrderItemSnapshot = {
  skuId: string;
  variantSlug: string | null;
  name: string;
  image: string | null;
  unitPriceInr: number;
  qty: number;
  lineTotalInr: number;
};

export async function POST(req: Request) {
  let body: z.infer<typeof BodySchema>;
  try {
    const json = await req.json();
    body = BodySchema.parse(json);
  } catch (err) {
    return NextResponse.json(
      { error: "Invalid request body", details: err instanceof Error ? err.message : String(err) },
      { status: 400 },
    );
  }

  // ── Idempotency short-circuit ────────────────────────────────────
  // If this idempotency key already has an order, return the original
  // without touching anything else.
  const existing = await db
    .select()
    .from(orders)
    .where(eq(orders.idempotencyKey, body.idempotencyKey))
    .limit(1);

  if (existing.length > 0) {
    const o = existing[0];
    if (o.paymentMethod === "COD") {
      return NextResponse.json({
        ok: true,
        orderId: o.id,
        paymentMethod: "COD",
        amountInr: o.totalInr,
        replayed: true,
      });
    }
    return NextResponse.json({
      ok: true,
      orderId: o.id,
      paymentMethod: o.paymentMethod,
      razorpayOrderId: o.razorpayOrderId,
      razorpayKeyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
      amountInr: o.totalInr,
      customerName: (o.shippingAddress as { fullName: string }).fullName,
      customerEmail: (o.shippingAddress as { email?: string }).email,
      customerPhone: (o.shippingAddress as { phone: string }).phone,
      replayed: true,
    });
  }

  // ── 1. Validate every line item against catalog + variant inStock ──
  const lineItems: OrderItemSnapshot[] = [];
  let subtotal = 0;

  for (const item of body.items) {
    const sku = PRODUCTS.find((p) => p.id === item.skuId);
    if (!sku || sku.hidden) {
      return NextResponse.json(
        { error: `Product ${item.skuId} not available` },
        { status: 400 },
      );
    }
    let variantName: string | null = null;
    let variantImage: string | null = null;
    if (sku.colors && sku.colors.length > 0) {
      // SKUs with colors REQUIRE a variant selection.
      if (!item.variantSlug) {
        return NextResponse.json(
          { error: `Pick a colour for ${sku.name}` },
          { status: 400 },
        );
      }
      const variant = sku.colors.find((c) => c.slug === item.variantSlug);
      if (!variant) {
        return NextResponse.json(
          { error: `Colour ${item.variantSlug} not available for ${sku.name}` },
          { status: 400 },
        );
      }
      if (variant.stock <= 0) {
        return NextResponse.json(
          { error: `${sku.name} (${variant.name}) is sold out` },
          { status: 409 },
        );
      }
      if (item.qty > variant.stock) {
        return NextResponse.json(
          {
            error: `Only ${variant.stock} ${sku.name} (${variant.name}) left — reduce qty`,
          },
          { status: 409 },
        );
      }
      variantName = variant.name;
      variantImage = variant.image ?? null;
    }

    const displayName = variantName ? `${sku.name} · ${variantName}` : sku.name;
    const displayImage = variantImage ?? sku.heroImage ?? null;
    const lineTotal = sku.retailINR * item.qty;
    subtotal += lineTotal;
    lineItems.push({
      skuId: sku.id,
      variantSlug: item.variantSlug ?? null,
      name: displayName,
      image: displayImage,
      unitPriceInr: sku.retailINR,
      qty: item.qty,
      lineTotalInr: lineTotal,
    });
  }

  // ── 2. Compute fees + total server-side ────────────────────────
  const shipping = subtotal >= OFFERS.freeShippingMinINR ? 0 : 85;
  const codFee =
    body.paymentMethod === "COD" && subtotal < OFFERS.codFeeAppliesBelowINR
      ? OFFERS.codFeeINR
      : 0;
  const prepaidDiscount =
    body.paymentMethod !== "COD" ? OFFERS.prepaidDiscountINR : 0;

  // ── 3. Open transaction: coupon redemption, customer upsert, address
  //       insert, order insert. All-or-nothing.
  let orderId = generateOrderId("PRC");
  let attempts = 0;
  type TxnResult = {
    orderId: string;
    customerId: string;
    customerName: string;
    customerEmail: string;
    customerPhone: string;
    couponDiscountInr: number;
    appliedCouponCode: string | null;
    total: number;
  };

  let txnResult: TxnResult | null = null;

  while (attempts < 3 && !txnResult) {
    try {
      txnResult = await db.transaction(async (tx) => {
        let couponDiscountInr = 0;
        let appliedCouponCode: string | null = null;
        if (body.couponCode && body.couponCode.trim()) {
          try {
            const result = await redeemCoupon({
              tx,
              code: body.couponCode,
              siteId: body.siteId,
              subtotalInr: subtotal,
              shippingInr: shipping,
            });
            couponDiscountInr = result.discountInr;
            appliedCouponCode = result.code;
          } catch (err) {
            if (err instanceof CouponError) {
              throw new Error(`COUPON:${err.reason}`);
            }
            throw err;
          }
        }

        const totalBeforeCoupon = subtotal + shipping + codFee - prepaidDiscount;
        const total = Math.max(0, totalBeforeCoupon - couponDiscountInr);
        if (total <= 0) {
          throw new Error("BODY:Invalid total");
        }

        const [customer] = await tx
          .insert(customers)
          .values({
            phone: body.address.phone,
            email: body.address.email || null,
            name: body.address.fullName,
            firstSiteId: body.siteId,
          })
          .onConflictDoUpdate({
            target: customers.phone,
            set: {
              email: sql`coalesce(${customers.email}, excluded.email)`,
              name: sql`coalesce(${customers.name}, excluded.name)`,
              updatedAt: new Date(),
            },
          })
          .returning();

        await tx.insert(addresses).values({
          customerId: customer.id,
          fullName: body.address.fullName,
          phone: body.address.phone,
          line1: body.address.line1,
          line2: body.address.line2 || null,
          city: body.address.city,
          state: body.address.state,
          pincode: body.address.pincode,
        });

        await tx.insert(orders).values({
          id: orderId,
          siteId: body.siteId,
          customerId: customer.id,
          idempotencyKey: body.idempotencyKey,
          status: "PENDING",
          items: lineItems,
          shippingAddress: body.address,
          subtotalInr: subtotal,
          shippingInr: shipping,
          codFeeInr: codFee,
          discountInr: prepaidDiscount + couponDiscountInr,
          totalInr: total,
          couponCode: appliedCouponCode,
          paymentMethod: body.paymentMethod,
          paymentStatus: "PENDING",
        });

        await tx.insert(events).values({
          siteId: body.siteId,
          orderId,
          customerId: customer.id,
          type: "ORDER_CREATED",
          payload: {
            total,
            paymentMethod: body.paymentMethod,
            itemCount: lineItems.length,
            couponCode: appliedCouponCode,
            couponDiscountInr,
          },
          source: "user",
        });

        return {
          orderId,
          customerId: customer.id,
          customerName: body.address.fullName,
          customerEmail: body.address.email,
          customerPhone: body.address.phone,
          couponDiscountInr,
          appliedCouponCode,
          total,
        };
      });
    } catch (err) {
      if (
        err &&
        typeof err === "object" &&
        "code" in err &&
        (err as { code?: string }).code === "23505"
      ) {
        // Unique violation — could be order_id collision OR idempotency_key
        // race (a duplicate request started in parallel).
        const msg = (err as { detail?: string }).detail ?? "";
        if (msg.includes("idempotency_key")) {
          const replay = await db
            .select()
            .from(orders)
            .where(eq(orders.idempotencyKey, body.idempotencyKey))
            .limit(1);
          if (replay[0]) {
            const o = replay[0];
            return NextResponse.json({
              ok: true,
              orderId: o.id,
              paymentMethod: o.paymentMethod,
              amountInr: o.totalInr,
              razorpayOrderId: o.razorpayOrderId ?? undefined,
              razorpayKeyId:
                o.paymentMethod !== "COD" ? process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID : undefined,
              customerName: (o.shippingAddress as { fullName: string }).fullName,
              customerEmail: (o.shippingAddress as { email?: string }).email,
              customerPhone: (o.shippingAddress as { phone: string }).phone,
              replayed: true,
            });
          }
        }
        // nanoid collision — regenerate order id and retry.
        orderId = generateOrderId("PRC");
        attempts++;
        continue;
      }
      const message = err instanceof Error ? err.message : String(err);
      if (message.startsWith("COUPON:")) {
        return NextResponse.json(
          { error: message.slice(7) },
          { status: 400 },
        );
      }
      if (message.startsWith("BODY:")) {
        return NextResponse.json({ error: message.slice(5) }, { status: 400 });
      }
      logError("order:create:txn", err, { orderId, idempotencyKey: body.idempotencyKey });
      return NextResponse.json(
        { error: "Order creation failed" },
        { status: 500 },
      );
    }
  }

  if (!txnResult) {
    return NextResponse.json(
      { error: "Order ID collision — please retry" },
      { status: 500 },
    );
  }

  const { customerId, customerName, customerEmail, customerPhone, total } = txnResult;
  orderId = txnResult.orderId;

  // ── 4. For prepaid orders, create the Razorpay order ─────────────
  if (body.paymentMethod !== "COD") {
    let rzpOrder;
    try {
      rzpOrder = await razorpay.orders.create({
        amount: total * 100,
        currency: "INR",
        receipt: orderId,
        notes: {
          site: body.siteId,
          customerId,
          phone: body.address.phone,
        },
      });
    } catch (err) {
      logError("order:create:razorpay", err, { orderId });
      await db.insert(events).values({
        siteId: body.siteId,
        orderId,
        customerId,
        type: "ORDER_RAZORPAY_FAILED",
        payload: { error: err instanceof Error ? err.message : String(err) },
        source: "system",
      }).catch(() => {});
      return NextResponse.json(
        { error: "Payment provider unavailable — try COD or retry in a minute." },
        { status: 503 },
      );
    }

    await db
      .update(orders)
      .set({ razorpayOrderId: rzpOrder.id, updatedAt: new Date() })
      .where(eq(orders.id, orderId));

    return NextResponse.json({
      ok: true,
      orderId,
      paymentMethod: body.paymentMethod,
      razorpayOrderId: rzpOrder.id,
      razorpayKeyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
      amountInr: total,
      customerName,
      customerEmail: customerEmail || undefined,
      customerPhone,
    });
  }

  // ── 5. COD path: mark PAID immediately, enqueue email, trigger shipment ──
  await db
    .update(orders)
    .set({
      status: "PAID",
      paidAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(orders.id, orderId));

  await db.insert(events).values({
    siteId: body.siteId,
    orderId,
    customerId,
    type: "ORDER_CONFIRMED_COD",
    payload: { total },
    source: "user",
  });

  try {
    const notificationId = await enqueueNotification({
      siteId: body.siteId,
      orderId,
      customerId,
      channel: "email",
      template: "ORDER_CONFIRMED",
      payload: {
        to: customerEmail,
        customerName,
        orderId,
        totalInr: total,
        paymentMethod: "COD",
        items: lineItems.map((i) => ({
          name: i.name,
          qty: i.qty,
          lineTotalInr: i.lineTotalInr,
        })),
      },
    });
    // Best-effort inline send — instant happy path, no cron lag.
    sendOutboxRow(notificationId).catch(() => {});
  } catch (err) {
    logError("order:create:enqueue-email", err, { orderId });
  }

  // Fire-and-forget in-process shipment creation. NOT an HTTP round-trip.
  triggerShipmentBackground(orderId);

  return NextResponse.json({
    ok: true,
    orderId,
    paymentMethod: "COD",
    amountInr: total,
  });
}
