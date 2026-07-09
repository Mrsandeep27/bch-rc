-- Product overrides: a thin admin-editable layer over the code catalogue
-- (src/lib/products.ts). Every column is nullable = "use the code value".
-- Apply via the Supabase SQL editor (this project applies migrations there,
-- not locally). Safe to run more than once.

CREATE TABLE IF NOT EXISTS product_overrides (
  site_id     text        NOT NULL REFERENCES sites(id),
  sku_id      text        NOT NULL,
  price_inr   integer,
  mrp_inr     integer,
  hidden      boolean,
  coming_soon boolean,
  badge       text,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  updated_by  text,
  PRIMARY KEY (site_id, sku_id)
);

-- RLS, same as every other public table (see 0004_enable_rls.sql): enabled with
-- NO policies, so the anon/authenticated PostgREST roles are denied outright.
-- The app reaches this table over the direct Postgres connection, which is not
-- subject to RLS. Without this, product_overrides would be the ONLY table in the
-- schema readable + writable through the public anon key.
ALTER TABLE public.product_overrides ENABLE ROW LEVEL SECURITY;
