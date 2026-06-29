-- Step-1 checkout lead capture (pre-payment).
--
-- Records a customer's contact + address the moment they finish the DETAILS
-- step of the 2-step checkout, before they pay. Surfaced on /admin/recovery so
-- the team can call / WhatsApp people who entered details but never paid.
-- One OPEN row per customer (unique customer_id, upserted on each fill);
-- flipped to CONVERTED when that customer creates any order. No stock / coupon
-- / Razorpay side effects — see src/db/schema.ts for the rationale.

DO $$ BEGIN
 CREATE TYPE "public"."checkout_lead_status" AS ENUM('OPEN', 'CONVERTED');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "checkout_leads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"site_id" text NOT NULL,
	"customer_id" uuid NOT NULL,
	"full_name" text NOT NULL,
	"phone" text NOT NULL,
	"email" text,
	"line1" text,
	"line2" text,
	"city" text,
	"state" text,
	"pincode" text,
	"items" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"subtotal_inr" integer DEFAULT 0 NOT NULL,
	"status" "checkout_lead_status" DEFAULT 'OPEN' NOT NULL,
	"converted_order_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "checkout_leads_customer_id_unique" UNIQUE("customer_id")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "checkout_leads" ADD CONSTRAINT "checkout_leads_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "checkout_leads" ADD CONSTRAINT "checkout_leads_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "checkout_leads_site_created_idx" ON "checkout_leads" USING btree ("site_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "checkout_leads_status_idx" ON "checkout_leads" USING btree ("status");
