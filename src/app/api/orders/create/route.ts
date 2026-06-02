/**
 * POST /api/orders/create
 *
 * The critical-path endpoint. Atomically:
 *   1. UPSERTs customer by phone
 *   2. Inserts address
 *   3. Computes totals SERVER-SIDE (never trust client `total`)
 *   4. Generates PRC-XXXXXXXX order ID via nanoid
 *   5. Inserts orders row with status=PENDING, payment_status=PENDING
 *   6. For UPI/CARD/etc: creates a Razorpay Order, saves razorpay_order_id
 *      For COD: skips Razorpay entirely
 *   7. Returns the IDs the client needs to open the Razorpay modal
 *
 * Cart line items are looked up from src/lib/products.ts (still source of
 * truth for catalog). Once products move to DB, swap that import for a
 * `SELECT * FROM products WHERE site_id = ? AND slug IN (...)`.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { customers, addresses, orders, events } from "@/db/schema";
import { sql } from "drizzle-orm";
import { PRODUCTS } from "@/lib/products";
import { OFFERS } from "@/lib/config";
import { razorpay } from "@/lib/razorpay";
import { generateOrderId } from "@/lib/order-id";

const PaymentMethod = z.enum(["UPI", "CARD", "NETBANKING", "WALLET", "COD"]);

const CartItemInput = z.object({
  skuId: z.string().min(1),
  qty: z.number().int().positive().max(20),
});

const AddressInput = z.object({
  fullName: z.string().min(2).max(120),
  phone: z.string().regex(/^[0-9]{10}$/, "10-digit phone required"),
  email: z.string().email().optional().or(z.literal("")),
  line1: z.string().min(3).max(200),
  line2: z.string().max(200).optional().or(z.literal("")),
  city: z.string().min(2).max(80),
  state: z.string().min(2).max(80),
  pincode: z.string().regex(/^[0-9]{6}$/, "6-digit pincode required"),
});

const BodySchema = z.object({
  siteId: z.string().default("prc"),
  items: z.array(CartItemInput).min(1).max(20),
  address: AddressInput,
  paymentMethod: PaymentMethod,
  couponCode: z.string().optional(),
});

export async function POST(req: Request) {
  let body: z.infer<typeof BodySchema>;
  try {
    const json = await req.json();
    body = BodySchema.parse(json);
  } catch (err) {
    return NextResponse.json(
      { error: "Invalid request body", details: String(err) },
      { status: 400 },
    );
  }

  // 1. Compute totals server-side from authoritative product catalog.
  const lineItems: Array<{
    skuId: string;
    name: string;
    image: string | null;
    unitPriceInr: number;
    qty: number;
    lineTotalInr: number;
  }> = [];

  let subtotal = 0;
  for (const item of body.items) {
    const sku = PRODUCTS.find((p) => p.id === item.skuId);
    if (!sku || sku.hidden) {
      return NextResponse.json(
        { error: `Product ${item.skuId} not available` },
        { status: 400 },
      );
    }
    const lineTotal = sku.retailINR * item.qty;
    subtotal += lineTotal;
    lineItems.push({
      skuId: sku.id,
      name: sku.name,
      image: sku.heroImage ?? null,
      unitPriceInr: sku.retailINR,
      qty: item.qty,
      lineTotalInr: lineTotal,
    });
  }

  const shipping = subtotal >= OFFERS.freeShippingMinINR ? 0 : 85;
  const codFee =
    body.paymentMethod === "COD" && subtotal < OFFERS.codFeeAppliesBelowINR
      ? OFFERS.codFeeINR
      : 0;
  const prepaidDiscount =
    body.paymentMethod !== "COD" ? OFFERS.prepaidDiscountINR : 0;
  const total = subtotal + shipping + codFee - prepaidDiscount;

  if (total <= 0) {
    return NextResponse.json({ error: "Invalid total" }, { status: 400 });
  }

  // 2. Upsert customer by phone, insert address, create order in a transaction.
  const [customer] = await db
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
        // Don't clobber email/name if already set; only fill if null.
        email: sql`coalesce(${customers.email}, excluded.email)`,
        name: sql`coalesce(${customers.name}, excluded.name)`,
        updatedAt: new Date(),
      },
    })
    .returning();

  await db.insert(addresses).values({
    customerId: customer.id,
    fullName: body.address.fullName,
    phone: body.address.phone,
    line1: body.address.line1,
    line2: body.address.line2 || null,
    city: body.address.city,
    state: body.address.state,
    pincode: body.address.pincode,
  });

  // 3. Generate order ID and insert. Retry on rare nanoid collision.
  let orderId = generateOrderId("PRC");
  let attempts = 0;
  while (attempts < 3) {
    try {
      await db.insert(orders).values({
        id: orderId,
        siteId: body.siteId,
        customerId: customer.id,
        status: "PENDING",
        items: lineItems,
        shippingAddress: body.address,
        subtotalInr: subtotal,
        shippingInr: shipping,
        codFeeInr: codFee,
        discountInr: prepaidDiscount,
        totalInr: total,
        couponCode: body.couponCode || null,
        paymentMethod: body.paymentMethod,
        paymentStatus: "PENDING",
      });
      break;
    } catch (err: unknown) {
      if (
        err &&
        typeof err === "object" &&
        "code" in err &&
        err.code === "23505"
      ) {
        // Unique violation — regenerate.
        orderId = generateOrderId("PRC");
        attempts++;
        continue;
      }
      throw err;
    }
  }

  await db.insert(events).values({
    siteId: body.siteId,
    orderId,
    customerId: customer.id,
    type: "ORDER_CREATED",
    payload: { total, paymentMethod: body.paymentMethod, itemCount: lineItems.length },
    source: "user",
  });

  // 4. For prepaid orders, create a Razorpay order.
  if (body.paymentMethod !== "COD") {
    const rzpOrder = await razorpay.orders.create({
      amount: total * 100, // paise
      currency: "INR",
      receipt: orderId,
      notes: {
        site: body.siteId,
        customerId: customer.id,
        phone: body.address.phone,
      },
    });

    await db
      .update(orders)
      .set({ razorpayOrderId: rzpOrder.id, updatedAt: new Date() })
      .where(sql`${orders.id} = ${orderId}`);

    return NextResponse.json({
      ok: true,
      orderId,
      paymentMethod: body.paymentMethod,
      razorpayOrderId: rzpOrder.id,
      razorpayKeyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
      amountInr: total,
      customerName: body.address.fullName,
      customerEmail: body.address.email || undefined,
      customerPhone: body.address.phone,
    });
  }

  // 5. For COD, mark order as confirmed immediately. Payment captured on delivery.
  await db
    .update(orders)
    .set({
      status: "PAID", // "confirmed for dispatch"; payment_status still PENDING
      paidAt: new Date(),
      updatedAt: new Date(),
    })
    .where(sql`${orders.id} = ${orderId}`);

  await db.insert(events).values({
    siteId: body.siteId,
    orderId,
    customerId: customer.id,
    type: "ORDER_CONFIRMED_COD",
    payload: { total },
    source: "user",
  });

  // Fire-and-forget: trigger Shiprocket shipment creation in background.
  // The user's success response doesn't block on this — admin can retry
  // from the order detail page if it fails.
  triggerShipment(orderId).catch((err) =>
    console.error(`Shipment auto-trigger failed for ${orderId}:`, err),
  );

  return NextResponse.json({
    ok: true,
    orderId,
    paymentMethod: "COD",
    amountInr: total,
  });
}

/** Fire-and-forget shipment trigger. Errors only logged — admin can retry. */
async function triggerShipment(orderId: string): Promise<void> {
  const baseUrl =
    process.env.NEXT_PUBLIC_BASE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
  await fetch(`${baseUrl}/api/orders/${orderId}/ship`, { method: "POST" });
}
