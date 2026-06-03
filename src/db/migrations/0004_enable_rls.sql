-- Enable Row Level Security on every public table.
--
-- With RLS enabled and no policies attached, the public `anon` role + the
-- signed-in `authenticated` role get zero access via PostgREST (the
-- /rest/v1/ API exposed by the project URL). The `service_role` key and
-- the direct `postgres` superuser connection used by Drizzle both bypass
-- RLS, so our server-side application code is unaffected.
--
-- This closes the "RLS Disabled in Public" critical findings reported by
-- the Supabase Advisor (17 tables flagged on 2026-06-04). The threat model
-- it shuts down: someone reads NEXT_PUBLIC_SUPABASE_ANON_KEY from the
-- browser bundle (it's public by design) and hits /rest/v1/orders directly
-- to dump the customer database. With RLS on + no policies, they get
-- nothing.
--
-- If we ever need direct anon reads from the browser (e.g. a public
-- product catalogue rendered client-side), add an explicit SELECT policy
-- per table later. Default-deny is the secure baseline.

ALTER TABLE public.sites                          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers                      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.addresses                      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products                       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_variants               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews                        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.carts                          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders                         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory                      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipment_jobs                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications_outbox           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupons                        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_coupon_redemptions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events                         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhooks_inbound               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admins                         ENABLE ROW LEVEL SECURITY;
