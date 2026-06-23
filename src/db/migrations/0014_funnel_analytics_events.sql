CREATE TABLE IF NOT EXISTS "funnel_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"site_id" text,
	"session_id" text,
	"visitor_id" text,
	"type" text NOT NULL,
	"path" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"order_id" text,
	"is_bot" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "funnel_events" ADD CONSTRAINT "funnel_events_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "funnel_events_site_created_idx" ON "funnel_events" USING btree ("site_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "funnel_events_type_idx" ON "funnel_events" USING btree ("type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "funnel_events_session_idx" ON "funnel_events" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "funnel_events_visitor_idx" ON "funnel_events" USING btree ("visitor_id");
