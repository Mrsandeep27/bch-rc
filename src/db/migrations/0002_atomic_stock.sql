-- Atomic stock + per-customer coupon enforcement.
-- 1) inventory table — per (site_id, sku_id, variant_slug). Order create does
--    UPDATE inventory SET stock = stock - $qty WHERE ... AND stock >= $qty
--    RETURNING. Zero rows → reject; never oversells under concurrency.
-- 2) customer_coupon_redemptions — append-only ledger keyed (customer_id,
--    coupon_id, order_id). Per-customer counts enforced via row count
--    inside the order transaction.

CREATE TABLE "inventory" (
	"site_id" text NOT NULL,
	"sku_id" text NOT NULL,
	"variant_slug" text NOT NULL DEFAULT '',
	"stock" integer NOT NULL DEFAULT 0,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "inventory_pkey" PRIMARY KEY ("site_id", "sku_id", "variant_slug"),
	CONSTRAINT "inventory_stock_nonneg" CHECK ("stock" >= 0)
);--> statement-breakpoint

ALTER TABLE "inventory" ADD CONSTRAINT "inventory_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint

CREATE INDEX "inventory_site_sku_idx" ON "inventory" USING btree ("site_id","sku_id");--> statement-breakpoint

CREATE TABLE "customer_coupon_redemptions" (
	"customer_id" uuid NOT NULL,
	"coupon_id" uuid NOT NULL,
	"order_id" text NOT NULL,
	"discount_inr" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "customer_coupon_redemptions_pkey" PRIMARY KEY ("customer_id", "coupon_id", "order_id")
);--> statement-breakpoint

ALTER TABLE "customer_coupon_redemptions" ADD CONSTRAINT "customer_coupon_redemptions_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "customer_coupon_redemptions" ADD CONSTRAINT "customer_coupon_redemptions_coupon_id_coupons_id_fk" FOREIGN KEY ("coupon_id") REFERENCES "public"."coupons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "customer_coupon_redemptions" ADD CONSTRAINT "customer_coupon_redemptions_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint

CREATE INDEX "customer_coupon_lookup_idx" ON "customer_coupon_redemptions" USING btree ("customer_id","coupon_id");
