ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "source" text DEFAULT 'direct' NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "utm_source" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "utm_medium" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "utm_campaign" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "utm_content" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "referrer_host" text;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "orders_source_idx" ON "orders" USING btree ("source");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "orders_utm_campaign_idx" ON "orders" USING btree ("utm_campaign");
