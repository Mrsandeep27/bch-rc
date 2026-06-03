/**
 * pocketrccars.com — Drizzle schema for the multi-tenant Postgres in Supabase (Mumbai).
 *
 * Architecture: ONE Postgres, N sites. Every per-site row carries `site_id`.
 * Customers + addresses are shared across all sites (phone is global identity).
 *
 * 12 tables: sites, customers, addresses, products, product_variants,
 * reviews, carts, orders, coupons, events, webhooks_inbound, admins.
 *
 * Source of truth for everything money-related. Razorpay / Shiprocket state
 * is mirrored here via webhooks; the DB row is canonical for the UI.
 */

import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

// ============================================================
// ENUMS — keep these short; storefront text comes from a UI map
// ============================================================

export const orderStatusEnum = pgEnum("order_status", [
  "PENDING",
  "PAID",
  "PACKED",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
  "RETURNED",
  "REFUNDED",
  "FAILED",
  "ABANDONED",
]);

export const paymentMethodEnum = pgEnum("payment_method", [
  "UPI",
  "CARD",
  "NETBANKING",
  "WALLET",
  "COD",
]);

export const paymentStatusEnum = pgEnum("payment_status", [
  "PENDING",
  "CAPTURED",
  "FAILED",
  "REFUNDED",
  "PARTIALLY_REFUNDED",
]);

export const couponTypeEnum = pgEnum("coupon_type", [
  "FLAT_INR",
  "PERCENT",
  "FREE_SHIPPING",
]);

export const adminRoleEnum = pgEnum("admin_role", [
  "OWNER",
  "MANAGER",
  "SUPPORT",
]);

// ============================================================
// 1. SITES — the 5 storefronts
// ============================================================

export const sites = pgTable("sites", {
  id: text("id").primaryKey(), // slug e.g. "prc", "rc43"
  name: text("name").notNull(),
  domain: text("domain").notNull().unique(),
  scale: text("scale").notNull(), // "1:64"
  orderIdPrefix: text("order_id_prefix").notNull(), // "PRC"
  brandTheme: jsonb("brand_theme").notNull().default({}),
  gstin: text("gstin"),
  legalName: text("legal_name"),
  registeredAddress: text("registered_address"),
  supportPhone: text("support_phone"),
  supportEmail: text("support_email"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ============================================================
// 2. CUSTOMERS — shared across all sites (phone = global identity)
// ============================================================

export const customers = pgTable(
  "customers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    phone: text("phone").notNull().unique(),
    email: text("email"),
    name: text("name"),
    /** Nullable: only set when customer signs up via Google / magic link. */
    authUserId: uuid("auth_user_id"),
    firstSiteId: text("first_site_id").references(() => sites.id),
    totalOrders: integer("total_orders").notNull().default(0),
    totalSpentInr: integer("total_spent_inr").notNull().default(0),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("customers_email_idx").on(t.email),
    index("customers_auth_user_idx").on(t.authUserId),
  ],
);

// ============================================================
// 3. ADDRESSES
// ============================================================

export const addresses = pgTable(
  "addresses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    label: text("label"),
    fullName: text("full_name").notNull(),
    phone: text("phone").notNull(),
    line1: text("line1").notNull(),
    line2: text("line2"),
    city: text("city").notNull(),
    state: text("state").notNull(),
    pincode: text("pincode").notNull(),
    isDefault: boolean("is_default").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("addresses_customer_idx").on(t.customerId)],
);

// ============================================================
// 4. PRODUCTS
// ============================================================

export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    siteId: text("site_id")
      .notNull()
      .references(() => sites.id),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    tagline: text("tagline"),
    bullets: text("bullets")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    badge: text("badge"),
    bodyShape: text("body_shape"),
    heroImage: text("hero_image"),
    heroVideo: text("hero_video"),
    altImages: text("alt_images")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    priceInr: integer("price_inr").notNull(),
    mrpInr: integer("mrp_inr").notNull(),
    landingCostInr: integer("landing_cost_inr"),
    specs: jsonb("specs").notNull().default({}),
    hidden: boolean("hidden").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique("products_site_slug_unique").on(t.siteId, t.slug),
    index("products_site_idx").on(t.siteId),
  ],
);

// ============================================================
// 5. PRODUCT VARIANTS — color variants per product
// ============================================================

export const productVariants = pgTable(
  "product_variants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    name: text("name").notNull(), // "Blue"
    slug: text("slug").notNull(), // "blue"
    swatch: text("swatch"), // hex or "gradient:from,to"
    /** Syed manages stock externally; we only flip available/sold-out. */
    inStock: boolean("in_stock").notNull().default(true),
    /** Per-variant price override. Null = use products.priceInr. */
    priceInrOverride: integer("price_inr_override"),
    image: text("image"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [unique("variants_product_slug_unique").on(t.productId, t.slug)],
);

// ============================================================
// 6. REVIEWS
// ============================================================

export const reviews = pgTable(
  "reviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id").references(() => customers.id),
    rating: integer("rating").notNull(), // 1-5
    title: text("title"),
    body: text("body"),
    verifiedPurchase: boolean("verified_purchase").notNull().default(false),
    images: text("images")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    approved: boolean("approved").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("reviews_product_idx").on(t.productId)],
);

// ============================================================
// 7. CARTS — anonymous (session_token) + logged-in (customer_id)
// ============================================================

export const carts = pgTable(
  "carts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    siteId: text("site_id")
      .notNull()
      .references(() => sites.id),
    sessionToken: text("session_token").notNull(),
    customerId: uuid("customer_id").references(() => customers.id),
    items: jsonb("items").notNull().default([]),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [unique("carts_site_session_unique").on(t.siteId, t.sessionToken)],
);

// ============================================================
// 8. ORDERS — the canonical record
// ============================================================

export const orders = pgTable(
  "orders",
  {
    id: text("id").primaryKey(), // "PRC-A7K2M9PQ"
    siteId: text("site_id")
      .notNull()
      .references(() => sites.id),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id),
    /** Client-generated idempotency key. UNIQUE — second submit returns the original order. */
    idempotencyKey: text("idempotency_key"),
    status: orderStatusEnum("status").notNull().default("PENDING"),
    /** Snapshot of line items at order time (name, image, price, variant). */
    items: jsonb("items").notNull(),
    /** Snapshot of shipping address at order time. */
    shippingAddress: jsonb("shipping_address").notNull(),
    subtotalInr: integer("subtotal_inr").notNull(),
    shippingInr: integer("shipping_inr").notNull().default(0),
    codFeeInr: integer("cod_fee_inr").notNull().default(0),
    discountInr: integer("discount_inr").notNull().default(0),
    totalInr: integer("total_inr").notNull(),
    couponCode: text("coupon_code"),
    paymentMethod: paymentMethodEnum("payment_method").notNull(),
    paymentStatus: paymentStatusEnum("payment_status")
      .notNull()
      .default("PENDING"),
    razorpayOrderId: text("razorpay_order_id"),
    razorpayPaymentId: text("razorpay_payment_id"),
    razorpaySignature: text("razorpay_signature"),
    shiprocketOrderId: text("shiprocket_order_id"),
    shiprocketShipmentId: text("shiprocket_shipment_id"),
    awbCode: text("awb_code"),
    courierName: text("courier_name"),
    trackingUrl: text("tracking_url"),
    notes: text("notes"),
    /**
     * Exactly-once guard for releasing reserved inventory + coupon usage back.
     * Flipped true atomically the first (and only) time an order's holds are
     * released on a terminal-unfulfilled transition (FAILED / ABANDONED /
     * CANCELLED / REFUNDED). The conditional UPDATE that flips it IS the claim.
     */
    holdsReleased: boolean("holds_released").notNull().default(false),
    placedAt: timestamp("placed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    packedAt: timestamp("packed_at", { withTimezone: true }),
    shippedAt: timestamp("shipped_at", { withTimezone: true }),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("orders_site_idx").on(t.siteId),
    index("orders_customer_idx").on(t.customerId),
    index("orders_status_idx").on(t.status),
    index("orders_razorpay_order_idx").on(t.razorpayOrderId),
    index("orders_awb_idx").on(t.awbCode),
    index("orders_shiprocket_shipment_idx").on(t.shiprocketShipmentId),
    unique("orders_idempotency_key_unique").on(t.idempotencyKey),
    // Reconciliation sweeps query (status, placed_at) for stale PENDING and
    // (status, paid_at) for PAID-without-shipment.
    index("orders_status_placed_idx").on(t.status, t.placedAt),
    index("orders_status_paid_idx").on(t.status, t.paidAt),
  ],
);

// ============================================================
// 8a. INVENTORY — atomic stock per (site_id, sku_id, variant_slug)
// ============================================================
// Order create runs:
//   UPDATE inventory SET stock = stock - $qty
//   WHERE site_id = $s AND sku_id = $k AND variant_slug = $v AND stock >= $qty
//   RETURNING stock;
// Zero rows back → reject (cannot oversell). Empty variantSlug = "" for SKUs
// without colour variants. Concurrency safe under Postgres' default isolation.

export const inventory = pgTable(
  "inventory",
  {
    siteId: text("site_id")
      .notNull()
      .references(() => sites.id),
    skuId: text("sku_id").notNull(),
    variantSlug: text("variant_slug").notNull().default(""),
    stock: integer("stock").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // Composite PK is the single source of truth per (site, sku, variant) and
    // makes the seed UPSERT + atomic decrement safe. Declared here so Drizzle
    // never diffs it away (the constraint shipped in migration 0002).
    primaryKey({ columns: [t.siteId, t.skuId, t.variantSlug] }),
    // Hard floor: the gated UPDATE prevents oversell, this CHECK is the
    // last-line backstop so stock can never physically go negative.
    check("inventory_stock_nonneg", sql`${t.stock} >= 0`),
    index("inventory_site_sku_idx").on(t.siteId, t.skuId),
  ],
);

// ============================================================
// 8c. SHIPMENT JOBS — durable fulfillment queue (one job per order)
// ============================================================
// Exactly-once shipment creation. The PK on order_id means verify + webhook +
// COD-create + admin-retry all INSERT ... ON CONFLICT DO NOTHING → a single
// job ever exists per order. Workers claim a job by the atomic transition
// PENDING → PROCESSING (a conditional UPDATE), so only one worker runs it.
// Failed jobs back off and retry; a reconciliation cron drains the queue and
// re-enqueues any PAID order missing a job.

export const shipmentJobStatusEnum = pgEnum("shipment_job_status", [
  "PENDING",
  "PROCESSING",
  "DONE",
  "FAILED",
]);

export const shipmentJobs = pgTable(
  "shipment_jobs",
  {
    orderId: text("order_id")
      .primaryKey()
      .references(() => orders.id),
    status: shipmentJobStatusEnum("status").notNull().default("PENDING"),
    attempts: integer("attempts").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(8),
    /** When the worker may next claim this job. Backoff pushes this forward. */
    nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    /** Set when a worker transitions to PROCESSING. Lease for stuck-job reaping. */
    lockedAt: timestamp("locked_at", { withTimezone: true }),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("shipment_jobs_claim_idx").on(t.status, t.nextAttemptAt),
  ],
);

// ============================================================
// 8b. NOTIFICATIONS OUTBOX — order/payment/shipment emails
// ============================================================

export const notificationsOutbox = pgTable(
  "notifications_outbox",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    siteId: text("site_id").references(() => sites.id),
    orderId: text("order_id").references(() => orders.id),
    customerId: uuid("customer_id").references(() => customers.id),
    channel: text("channel").notNull(), // "email" | "whatsapp"
    template: text("template").notNull(), // ORDER_CONFIRMED | PAYMENT_CAPTURED | SHIPMENT_CREATED | DELIVERED
    /**
     * Idempotency key, typically `${orderId}:${template}`. UNIQUE — enqueue is
     * ON CONFLICT DO NOTHING so verify + webhook firing the same notification
     * can only ever create one outbox row. Also forwarded to Resend as its
     * Idempotency-Key so a double inline/cron send is deduped provider-side.
     */
    dedupKey: text("dedup_key"),
    /** Snapshot of recipient + variables at enqueue time. */
    payload: jsonb("payload").notNull(),
    attempts: integer("attempts").notNull().default(0),
    /** When the worker should next try this row. */
    nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("notifications_pending_idx").on(t.sentAt, t.nextAttemptAt),
    index("notifications_order_idx").on(t.orderId),
    unique("notifications_dedup_key_unique").on(t.dedupKey),
  ],
);

// ============================================================
// 9. COUPONS
// ============================================================

export const coupons = pgTable(
  "coupons",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** null = applies to all sites */
    siteId: text("site_id").references(() => sites.id),
    code: text("code").notNull(),
    type: couponTypeEnum("type").notNull(),
    /** INR for FLAT_INR, percent×100 for PERCENT (e.g. 1500 = 15%) */
    value: integer("value").notNull(),
    minOrderInr: integer("min_order_inr").notNull().default(0),
    maxDiscountInr: integer("max_discount_inr"),
    usageLimit: integer("usage_limit"),
    usedCount: integer("used_count").notNull().default(0),
    perCustomerLimit: integer("per_customer_limit"),
    validFrom: timestamp("valid_from", { withTimezone: true })
      .notNull()
      .defaultNow(),
    validTo: timestamp("valid_to", { withTimezone: true }),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [unique("coupons_site_code_unique").on(t.siteId, t.code)],
);

// ============================================================
// 9a. CUSTOMER COUPON REDEMPTIONS — per-customer-limit enforcement
// ============================================================
// Append-only ledger. Row inserted inside the order transaction so the
// per-customer count is consistent with the order it grants discount on.

export const customerCouponRedemptions = pgTable(
  "customer_coupon_redemptions",
  {
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id),
    couponId: uuid("coupon_id")
      .notNull()
      .references(() => coupons.id),
    orderId: text("order_id")
      .notNull()
      .references(() => orders.id),
    discountInr: integer("discount_inr").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("customer_coupon_lookup_idx").on(t.customerId, t.couponId),
  ],
);

// ============================================================
// 10. EVENTS — append-only audit log
// ============================================================

export const events = pgTable(
  "events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    siteId: text("site_id").references(() => sites.id),
    orderId: text("order_id").references(() => orders.id),
    customerId: uuid("customer_id").references(() => customers.id),
    type: text("type").notNull(),
    payload: jsonb("payload").notNull().default({}),
    source: text("source"), // "system" / "admin" / "webhook" / "user"
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("events_site_idx").on(t.siteId),
    index("events_order_idx").on(t.orderId),
    index("events_type_idx").on(t.type),
    index("events_created_idx").on(t.createdAt),
  ],
);

// ============================================================
// 11. WEBHOOKS INBOUND — idempotency on (source, external_id)
// ============================================================

export const webhooksInbound = pgTable(
  "webhooks_inbound",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    source: text("source").notNull(), // "razorpay" / "shiprocket"
    externalId: text("external_id").notNull(), // their event id for dedup
    payload: jsonb("payload").notNull(),
    processed: boolean("processed").notNull().default(false),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique("webhooks_source_external_unique").on(t.source, t.externalId),
    index("webhooks_processed_idx").on(t.processed),
  ],
);

// ============================================================
// 12. ADMINS — cross-site dashboard access
// ============================================================

export const admins = pgTable("admins", {
  id: uuid("id").primaryKey().defaultRandom(),
  authUserId: uuid("auth_user_id").notNull().unique(),
  email: text("email").notNull().unique(),
  name: text("name"),
  /** Sites this admin can manage. Owner gets all 5. Sandeep gets all. */
  siteIds: text("site_ids")
    .array()
    .notNull()
    .default(sql`'{}'::text[]`),
  role: adminRoleEnum("role").notNull().default("MANAGER"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ============================================================
// Inferred types for app code
// ============================================================

export type Site = typeof sites.$inferSelect;
export type NewSite = typeof sites.$inferInsert;
export type Customer = typeof customers.$inferSelect;
export type NewCustomer = typeof customers.$inferInsert;
export type Address = typeof addresses.$inferSelect;
export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;
export type ProductVariant = typeof productVariants.$inferSelect;
export type NewProductVariant = typeof productVariants.$inferInsert;
export type Review = typeof reviews.$inferSelect;
export type Cart = typeof carts.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;
export type Coupon = typeof coupons.$inferSelect;
export type EventRow = typeof events.$inferSelect;
export type WebhookInbound = typeof webhooksInbound.$inferSelect;
export type AdminRow = typeof admins.$inferSelect;
export type NotificationRow = typeof notificationsOutbox.$inferSelect;
export type NewNotification = typeof notificationsOutbox.$inferInsert;
export type InventoryRow = typeof inventory.$inferSelect;
export type NewInventory = typeof inventory.$inferInsert;
export type ShipmentJob = typeof shipmentJobs.$inferSelect;
export type NewShipmentJob = typeof shipmentJobs.$inferInsert;
export type CustomerCouponRedemption = typeof customerCouponRedemptions.$inferSelect;
export type NewCustomerCouponRedemption = typeof customerCouponRedemptions.$inferInsert;
