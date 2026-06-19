-- Track manifest / pickup state so an order moves OUT of "Ready to Ship" into
-- "Pickups & Manifests" once its manifest is generated (mirrors Shiprocket).
-- Previously both tabs shared the PACKED+AWB filter, so the same order showed
-- in both places.
--
-- Safe live deploy: additive, nullable.

ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "manifested_at" timestamptz;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "manifest_url" text;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "pickup_scheduled_at" timestamptz;

-- Backfill: any order already PACKED with an AWB has, in practice, already
-- been manifested (these are live shipped orders). Mark them so they land in
-- Pickups & Manifests instead of incorrectly re-appearing in Ready to Ship.
UPDATE "orders"
SET "manifested_at" = COALESCE("packed_at", now())
WHERE "status" = 'PACKED' AND "awb_code" IS NOT NULL AND "manifested_at" IS NULL;
