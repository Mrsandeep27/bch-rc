-- Surge hardening: inventory/coupon release, durable shipment queue,
-- notification dedup, and the constraints that protect them.
--
-- Written idempotently (IF [NOT] EXISTS / guarded DO blocks) so it is safe to
-- apply to a database that already has 0000-0002, and safe to re-run.

-- ────────────────────────────────────────────────────────────────────────
-- 1. Inventory: re-assert the PK + non-negative CHECK in case an earlier
--    `db:push` against a drifted schema.ts dropped them. No-op when present.
-- ────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'inventory_pkey'
  ) THEN
    ALTER TABLE "inventory" ADD CONSTRAINT "inventory_pkey"
      PRIMARY KEY ("site_id", "sku_id", "variant_slug");
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'inventory_stock_nonneg'
  ) THEN
    ALTER TABLE "inventory" ADD CONSTRAINT "inventory_stock_nonneg"
      CHECK ("stock" >= 0);
  END IF;
END $$;--> statement-breakpoint

-- ────────────────────────────────────────────────────────────────────────
-- 2. Orders: exactly-once holds-release guard + reconciliation indexes.
-- ────────────────────────────────────────────────────────────────────────
ALTER TABLE "orders"
  ADD COLUMN IF NOT EXISTS "holds_released" boolean NOT NULL DEFAULT false;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "orders_status_placed_idx" ON "orders" USING btree ("status","placed_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "orders_status_paid_idx" ON "orders" USING btree ("status","paid_at");--> statement-breakpoint

-- ────────────────────────────────────────────────────────────────────────
-- 3. Durable shipment job queue. One row per order (PK on order_id) →
--    enqueue is ON CONFLICT DO NOTHING → exactly-once shipment creation.
-- ────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'shipment_job_status') THEN
    CREATE TYPE "public"."shipment_job_status" AS ENUM('PENDING','PROCESSING','DONE','FAILED');
  END IF;
END $$;--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "shipment_jobs" (
  "order_id" text PRIMARY KEY NOT NULL,
  "status" "shipment_job_status" NOT NULL DEFAULT 'PENDING',
  "attempts" integer NOT NULL DEFAULT 0,
  "max_attempts" integer NOT NULL DEFAULT 8,
  "next_attempt_at" timestamp with time zone NOT NULL DEFAULT now(),
  "locked_at" timestamp with time zone,
  "last_error" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);--> statement-breakpoint

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'shipment_jobs_order_id_orders_id_fk'
  ) THEN
    ALTER TABLE "shipment_jobs" ADD CONSTRAINT "shipment_jobs_order_id_orders_id_fk"
      FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id")
      ON DELETE no action ON UPDATE no action;
  END IF;
END $$;--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "shipment_jobs_claim_idx" ON "shipment_jobs" USING btree ("status","next_attempt_at");--> statement-breakpoint

-- ────────────────────────────────────────────────────────────────────────
-- 4. Notifications outbox dedup key (exactly-once enqueue).
-- ────────────────────────────────────────────────────────────────────────
ALTER TABLE "notifications_outbox"
  ADD COLUMN IF NOT EXISTS "dedup_key" text;--> statement-breakpoint

-- Backfill existing rows so the unique index can be created without collisions.
UPDATE "notifications_outbox"
  SET "dedup_key" = COALESCE("order_id", "id"::text) || ':' || "template" || ':' || "id"::text
  WHERE "dedup_key" IS NULL;--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "notifications_dedup_key_unique"
  ON "notifications_outbox" USING btree ("dedup_key");--> statement-breakpoint
