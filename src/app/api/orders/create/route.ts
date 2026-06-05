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

import { NextResponse, after } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import {
  customers,
  addresses,
  orders,
  events,
  inventory,
  notificationsOutbox,
} from "@/db/schema";
import { sql, eq, and } from "drizzle-orm";
import { PRODUCTS } from "@/lib/products";
import { OFFERS, bundleDiscountInr } from "@/lib/config";
import { razorpay } from "@/lib/razorpay";
import { generateOrderId } from "@/lib/order-id";
import { redeemCoupon, CouponError } from "@/lib/coupons";
import { sendOutboxRow } from "@/lib/notifications/drain";
import { notifyOrderEvent, whatsappEnabled } from "@/lib/notifications/notify";
import { resolveServiceability } from "@/lib/serviceability";
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
    // Idempotency recovery: prior attempt persisted the order row but the
    // Razorpay API call failed (or hadn't run yet). Create the Razorpay
    // order now, persist, and return a usable payload. Without this, the
    // client opens Razorpay with order_id=null and the customer is stuck.
    let razorpayOrderId = o.razorpayOrderId;
    if (!razorpayOrderId) {
      try {
        const rzpOrder = await razorpay.orders.create({
          amount: o.totalInr * 100,
          currency: "INR",
          receipt: o.id,
          notes: {
            site: o.siteId,
            customerId: o.customerId,
            phone: (o.shippingAddress as { phone: string }).phone,
            recoveredFor: "idempotency-replay",
          },
        });
        razorpayOrderId = rzpOrder.id;
        await db
          .update(orders)
          .set({ razorpayOrderId, updatedAt: new Date() })
          .where(eq(orders.id, o.id));
      } catch (err) {
        logError("order:create:replay-razorpay", err, { orderId: o.id });
        return NextResponse.json(
          { error: "Payment provider unavailable — try COD or retry in a minute." },
          { status: 503 },
        );
      }
    }
    return NextResponse.json({
      ok: true,
      orderId: o.id,
      paymentMethod: o.paymentMethod,
      razorpayOrderId,
      razorpayKeyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
      amountInr: o.totalInr,
      customerName: (o.shippingAddress as { fullName: string }).fullName,
      customerEmail: (o.shippingAddress as { email?: string }).email,
      customerPhone: (o.shippingAddress as { phone: string }).phone,
      replayed: true,
    });
  }

  // ── 0. Serviceability gate ───────────────────────────────────────
  // HARD block before we create anything: never accept an order for a pincode
  // we can't deliver to, or COD where COD isn't available. This is the
  // authoritative check (the checkout UI previews the same result). Placed
  // after the idempotency short-circuit so replays of already-valid orders
  // always succeed.
  const svc = resolveServiceability(body.address.pincode);
  if (!svc.serviceable) {
    return NextResponse.json(
      { error: svc.reason ?? "We don't deliver to this pincode yet. WhatsApp us to check." },
      { status: 422 },
    );
  }
  if (body.paymentMethod === "COD" && !svc.codAvailable) {
    return NextResponse.json(
      {
        error:
          svc.reason ??
          "COD isn't available for this pincode — pay online to order (you save ₹100).",
      },
      { status: 422 },
    );
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
  // Bundle bonus — auto-applied when the customer adds any 2+ cars.
  // Driven by TOTAL cart quantity so 2-of-the-same and 1-each-of-two both
  // qualify. Server-side authoritative so a client can't spoof the discount.
  const cartQty = body.items.reduce((n, i) => n + i.qty, 0);
  const bundleDiscount = bundleDiscountInr(cartQty);

  // ── 3. Open transaction: atomic stock decrement, customer upsert, coupon
  //       redemption (with customerId for per-customer limit), address insert,
  //       order insert, event insert, notification outbox insert.
  //       All-or-nothing. Stock decrement is the FIRST mutation so an
  //       overselling attempt fails fast without touching customer data.
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
    notificationId: string | null;
  };

  let txnResult: TxnResult | null = null;

  while (attempts < 3 && !txnResult) {
    try {
      txnResult = await db.transaction(async (tx) => {
        // 3a. Atomic stock decrement. UPDATE returns the new stock row only
        //     when the gate (`stock >= $qty`) holds. Zero rows back → reject.
        //     Empty variantSlug ("") is the row for colourless SKUs.
        for (const item of body.items) {
          const variantKey = item.variantSlug ?? "";
          const sku = PRODUCTS.find((p) => p.id === item.skuId);
          if (!sku) continue; // already validated above
          const decremented = await tx
            .update(inventory)
            .set({ stock: sql`${inventory.stock} - ${item.qty}`, updatedAt: new Date() })
            .where(
              and(
                eq(inventory.siteId, body.siteId),
                eq(inventory.skuId, item.skuId),
                eq(inventory.variantSlug, variantKey),
                sql`${inventory.stock} >= ${item.qty}`,
              ),
            )
            .returning({ stock: inventory.stock });

          if (decremented.length === 0) {
            // Inventory row doesn't exist OR stock was insufficient. Look up
            // current stock to disambiguate in the error message.
            const current = await tx
              .select({ stock: inventory.stock })
              .from(inventory)
              .where(
                and(
                  eq(inventory.siteId, body.siteId),
                  eq(inventory.skuId, item.skuId),
                  eq(inventory.variantSlug, variantKey),
                ),
              );
            if (current.length === 0) {
              throw new Error(
                `STOCK:Inventory not configured for ${sku.name}${variantKey ? ` (${variantKey})` : ""}`,
              );
            }
            const available = current[0].stock;
            if (available <= 0) {
              throw new Error(
                `STOCK:${sku.name}${variantKey ? ` (${variantKey})` : ""} is sold out`,
              );
            }
            throw new Error(
              `STOCK:Only ${available} ${sku.name}${variantKey ? ` (${variantKey})` : ""} left — reduce qty`,
            );
          }
        }

        // 3b. UPSERT customer by phone. Needed before coupon redemption so
        //     the per-customer limit check has a customer id to count against.
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

        // 3c. INSERT the order row early with PENDING totals. We need the
        //     order id present in the DB before redeemCoupon (the ledger row
        //     FK-references orders.id) — but we don't know the final total
        //     yet. We'll UPDATE it after coupon redemption resolves.
        const totalBeforeCoupon =
          subtotal + shipping + codFee - prepaidDiscount - bundleDiscount;
        if (totalBeforeCoupon <= 0) {
          throw new Error("BODY:Invalid total");
        }

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
          discountInr: prepaidDiscount + bundleDiscount,
          totalInr: totalBeforeCoupon,
          couponCode: null,
          paymentMethod: body.paymentMethod,
          paymentStatus: "PENDING",
        });

        // 3d. Coupon — atomic redeem + per-customer-limit guard + ledger.
        let couponDiscountInr = 0;
        let appliedCouponCode: string | null = null;
        if (body.couponCode && body.couponCode.trim()) {
          try {
            const result = await redeemCoupon({
              tx,
              code: body.couponCode,
              siteId: body.siteId,
              customerId: customer.id,
              orderId,
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

        const total = Math.max(0, totalBeforeCoupon - couponDiscountInr);
        if (total <= 0) {
          throw new Error("BODY:Invalid total");
        }

        // 3e. Apply the coupon discount onto the order row.
        if (couponDiscountInr > 0) {
          await tx
            .update(orders)
            .set({
              discountInr: prepaidDiscount + bundleDiscount + couponDiscountInr,
              totalInr: total,
              couponCode: appliedCouponCode,
              updatedAt: new Date(),
            })
            .where(eq(orders.id, orderId));
        }

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

        // 3f. Enqueue the COD placeholder email INSIDE the transaction. COD
        //     orders no longer auto-confirm — they sit at
        //     PENDING_COD_VERIFICATION until the operator at /cod rings the
        //     customer and clicks Confirm. So the email at create-time is
        //     ORDER_RECEIVED ("we'll call to confirm within 24h"), not the
        //     full ORDER_CONFIRMED. The full confirmation fires from the
        //     /cod confirm action. Prepaid flow is unchanged (verify route
        //     sends PAYMENT_CAPTURED on capture).
        let notificationId: string | null = null;
        if (body.paymentMethod === "COD") {
          const [n] = await tx
            .insert(notificationsOutbox)
            .values({
              siteId: body.siteId,
              orderId,
              customerId: customer.id,
              channel: "email",
              template: "ORDER_RECEIVED",
              dedupKey: `${orderId}:ORDER_RECEIVED:email`,
              payload: {
                to: body.address.email,
                toPhone: body.address.phone,
                customerName: body.address.fullName,
                orderId,
                totalInr: total,
                paymentMethod: "COD",
                etaText: svc.etaText,
                items: lineItems.map((i) => ({
                  name: i.name,
                  qty: i.qty,
                  lineTotalInr: i.lineTotalInr,
                  image: i.image,
                })),
                subtotalInr: subtotal,
                shippingInr: shipping,
                codFeeInr: codFee,
                discountInr: prepaidDiscount + couponDiscountInr,
                couponCode: appliedCouponCode,
                shippingAddress: {
                  fullName: body.address.fullName,
                  phone: body.address.phone,
                  line1: body.address.line1,
                  line2: body.address.line2 || null,
                  city: body.address.city,
                  state: body.address.state,
                  pincode: body.address.pincode,
                },
              },
            })
            .returning({ id: notificationsOutbox.id });
          notificationId = n?.id ?? null;
        }

        return {
          orderId,
          customerId: customer.id,
          customerName: body.address.fullName,
          customerEmail: body.address.email,
          customerPhone: body.address.phone,
          couponDiscountInr,
          appliedCouponCode,
          total,
          notificationId,
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
      if (message.startsWith("STOCK:")) {
        return NextResponse.json(
          { error: message.slice(6) },
          { status: 409 },
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

  // ── 5. COD path: mark PENDING_COD_VERIFICATION, send placeholder email ──
  //
  // COD orders DO NOT auto-confirm. They land in a manual-verify queue at
  // /cod where the operator rings the customer to confirm — kills prank/kid
  // orders before any shipment cost is incurred. No Shiprocket order is
  // created at this point. The /cod confirm action transitions to PAID and
  // enqueues the shipment job; the 48h auto-reject sweeper releases stock
  // for anything left hanging.
  await db
    .update(orders)
    .set({
      status: "PENDING_COD_VERIFICATION",
      updatedAt: new Date(),
    })
    .where(eq(orders.id, orderId));

  await db.insert(events).values({
    siteId: body.siteId,
    orderId,
    customerId,
    type: "COD_VERIFICATION_PENDING",
    payload: { total },
    source: "user",
  });

  // Outbox row was inserted INSIDE the order transaction (durable). Inline
  // send via `after()` so it runs past the response without the serverless
  // instance freezing it mid-flight; the reconcile cron drains any failure.
  const notificationId = txnResult.notificationId;
  if (notificationId) {
    after(() =>
      sendOutboxRow(notificationId).catch((err) =>
        logError("order:create:inline-send", err, { orderId }),
      ),
    );
  }

  // WhatsApp placeholder too (email above is the durable in-txn row). Only
  // when enabled; runs past the response so it never blocks checkout.
  if (whatsappEnabled()) {
    after(() => notifyOrderEvent(orderId, "ORDER_RECEIVED", ["whatsapp"]));
  }

  return NextResponse.json({
    ok: true,
    orderId,
    paymentMethod: "COD",
    amountInr: total,
  });
}
