-- Launch-blocker schema additions
-- 1) idempotency_key on orders -> blocks double-submit at the DB level
-- 2) notifications_outbox -> async order confirmation + shipment emails
-- 3) shiprocket_shipment lookup index -> webhook + cron sync path

ALTER TABLE "orders" ADD COLUMN "idempotency_key" text;--> statement-breakpoint

CREATE UNIQUE INDEX "orders_idempotency_key_unique" ON "orders" USING btree ("idempotency_key");--> statement-breakpoint

CREATE INDEX "orders_shiprocket_shipment_idx" ON "orders" USING btree ("shiprocket_shipment_id");--> statement-breakpoint

CREATE TABLE "notifications_outbox" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"site_id" text,
	"order_id" text,
	"customer_id" uuid,
	"channel" text NOT NULL,
	"template" text NOT NULL,
	"payload" jsonb NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

ALTER TABLE "notifications_outbox" ADD CONSTRAINT "notifications_outbox_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "notifications_outbox" ADD CONSTRAINT "notifications_outbox_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "notifications_outbox" ADD CONSTRAINT "notifications_outbox_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint

CREATE INDEX "notifications_pending_idx" ON "notifications_outbox" USING btree ("sent_at","next_attempt_at");--> statement-breakpoint

CREATE INDEX "notifications_order_idx" ON "notifications_outbox" USING btree ("order_id");
