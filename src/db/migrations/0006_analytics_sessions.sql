-- First-party, server-side visitor analytics.
--
-- One row per visitor session, written by the edge middleware via a
-- server-to-server call to /api/track (so ad-blockers never intercept it).
-- A session is a 30-minute sliding window keyed by the `prc_sid` cookie; the
-- stable `prc_vid` cookie (1 year) is the unique-visitor key. Cookies are
-- first-party and domain-scoped, so unique-visitor counts are PER-SITE.
--
-- Sessions-only (no per-pageview table): the dashboard metrics (visitors,
-- conversion rate, live visitors, traffic sources) all derive from sessions,
-- and prod runs one DB connection per Lambda — so /api/track UPSERTs one row
-- per pageview (bumping pageview_count + last_seen_at) instead of inserting a
-- row each time.

CREATE TABLE IF NOT EXISTS "analytics_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"visitor_id" text NOT NULL,
	"site_id" text NOT NULL,
	"source" text DEFAULT 'direct' NOT NULL,
	"referrer" text,
	"referrer_host" text,
	"landing_path" text,
	"utm_source" text,
	"utm_medium" text,
	"utm_campaign" text,
	"utm_term" text,
	"utm_content" text,
	"country" text,
	"user_agent" text,
	"is_bot" boolean DEFAULT false NOT NULL,
	"pageview_count" integer DEFAULT 1 NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "analytics_sessions" ADD CONSTRAINT "analytics_sessions_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "analytics_sessions_site_started_idx" ON "analytics_sessions" USING btree ("site_id","started_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "analytics_sessions_site_lastseen_idx" ON "analytics_sessions" USING btree ("site_id","last_seen_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "analytics_sessions_visitor_idx" ON "analytics_sessions" USING btree ("visitor_id");
