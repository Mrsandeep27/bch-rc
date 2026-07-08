-- Enable Row Level Security on tables created AFTER 0004_enable_rls.sql.
--
-- 0004 enabled RLS on the 16 tables that existed on 2026-06-04. Three tables
-- shipped later without it, which the Supabase Advisor flags as CRITICAL
-- ("RLS Disabled in Public" ×2 + "Sensitive Columns Exposed" on
-- funnel_events.session_id):
--   analytics_sessions  (0006)
--   funnel_events       (0014)
--   checkout_leads      (0016)
--
-- Same model as 0004: RLS on + zero policies = default-deny for the anon /
-- authenticated PostgREST roles. Server-side Drizzle connects as the table
-- owner and is unaffected. IF EXISTS guards keep this safe on databases where
-- 0016 hasn't created checkout_leads yet (it runs in the same migrate batch).

ALTER TABLE IF EXISTS public.analytics_sessions ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE IF EXISTS public.funnel_events      ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE IF EXISTS public.checkout_leads     ENABLE ROW LEVEL SECURITY;
