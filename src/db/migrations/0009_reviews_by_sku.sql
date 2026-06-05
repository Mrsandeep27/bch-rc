-- X06 + R01 — reviews module on a string SKU key.
--
-- The reviews table exists from 0000 keyed by product_id (uuid) but our
-- catalog is hardcoded in src/lib/products.ts using string ids like
-- "pocket-bmw". To wire reviews into the storefront PDP without forcing
-- a separate products-table migration, we add:
--   - sku_id (string)     — the string id from lib/products.ts
--   - site_id (FK)        — multi-tenant scoping
--   - order_id (FK)       — links to the verified purchase
--   - status (enum)       — pending / approved / rejected (replaces the
--                           single bool, so admin can keep + hide)
--   - source (enum)       — post_purchase (R01 flow) / admin_seed / import
--
-- product_id stays nullable. Anyone using the legacy uuid path keeps
-- working; the new SKU-string path becomes the storefront default.

CREATE TYPE review_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE review_source AS ENUM ('post_purchase', 'admin_seed', 'import');

ALTER TABLE reviews
  ADD COLUMN site_id text REFERENCES sites(id),
  ADD COLUMN sku_id text,
  ADD COLUMN order_id text REFERENCES orders(id),
  ADD COLUMN status review_status NOT NULL DEFAULT 'pending',
  ADD COLUMN source review_source NOT NULL DEFAULT 'post_purchase',
  ADD COLUMN customer_name text,
  ADD COLUMN customer_city text,
  ALTER COLUMN product_id DROP NOT NULL;

-- One review per (order, sku) combo — a buyer can review each SKU in
-- their order exactly once. Re-submitting overwrites the prior pending
-- row via the unique constraint at the app layer.
CREATE UNIQUE INDEX reviews_order_sku_unique
  ON reviews (order_id, sku_id)
  WHERE order_id IS NOT NULL AND sku_id IS NOT NULL;

-- Fast lookup for the PDP — "give me the approved reviews for this SKU
-- in this site, newest first".
CREATE INDEX reviews_site_sku_status_idx
  ON reviews (site_id, sku_id, status, created_at DESC);
