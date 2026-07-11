-- Bargain sessions: server-authoritative state for the "Name your price"
-- exit-intent haggle game. Holds ONLY game state (guesses, hidden floor, the
-- won coupon code) — the actual discount is a real single-use row in `coupons`,
-- so checkout/pricing stay untouched. See src/lib/bargain.ts.
--
-- Apply via the pooled runner (direct host unreachable from dev):
--   npx tsx --env-file=.env.local scripts/apply-manual-migration.ts \
--     src/db/migrations/manual/2026-07-11_bargain_sessions.sql
-- ...or paste into the Supabase SQL editor. Safe to run more than once.

CREATE TABLE IF NOT EXISTS bargain_sessions (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id       text        NOT NULL REFERENCES sites(id),
  device_key    text        NOT NULL,
  sku_id        text        NOT NULL,
  list_inr      integer     NOT NULL,
  floor_inr     integer     NOT NULL,
  attempts_used integer     NOT NULL DEFAULT 0,
  status        text        NOT NULL DEFAULT 'ACTIVE',
  won_price_inr integer,
  coupon_code   text,
  expires_at    timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (device_key, sku_id)
);

CREATE INDEX IF NOT EXISTS bargain_sessions_site_created_idx
  ON bargain_sessions (site_id, created_at);

-- RLS, same as every other public table (see 0004_enable_rls.sql): enabled with
-- NO policies, so the anon/authenticated PostgREST roles are denied outright.
-- The app reaches this table over the direct/pooled Postgres connection, which
-- is not subject to RLS.
ALTER TABLE public.bargain_sessions ENABLE ROW LEVEL SECURITY;

-- Bind a coupon to a single SKU. Null for every existing coupon (no behaviour
-- change); the bargain game sets it so a won discount can only be spent on the
-- exact car it was won on. Enforced in src/lib/coupons.ts + order create.
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS constraint_sku_id text;
