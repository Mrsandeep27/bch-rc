-- Manual order creation flow (Sandeep WhatsApp voice 2026-06-05 #1).
-- Adds three columns to the orders table so we can:
--   1. Track which orders were created by an admin vs by the customer.
--   2. Track WHICH admin created the manual order (for per-operator sales
--      attribution — Hassan / Syed / Sandeep can each see their own credit).
--   3. Store the Razorpay Payment Link ID for manual orders (separate from
--      razorpay_order_id which is only set on the customer-self-service flow).
--
-- All three columns are nullable / have safe defaults — old rows continue
-- to work as CUSTOMER_WEB without any backfill needed.

CREATE TYPE order_created_via AS ENUM ('CUSTOMER_WEB', 'ADMIN_MANUAL');

ALTER TABLE orders
  ADD COLUMN created_via order_created_via NOT NULL DEFAULT 'CUSTOMER_WEB',
  ADD COLUMN created_by_email text,
  ADD COLUMN razorpay_payment_link_id text;

CREATE INDEX idx_orders_created_via ON orders (created_via);
CREATE INDEX idx_orders_created_by_email ON orders (created_by_email)
  WHERE created_by_email IS NOT NULL;
CREATE UNIQUE INDEX idx_orders_razorpay_payment_link_id
  ON orders (razorpay_payment_link_id)
  WHERE razorpay_payment_link_id IS NOT NULL;
