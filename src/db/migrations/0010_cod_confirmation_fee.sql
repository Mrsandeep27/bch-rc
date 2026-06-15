-- Add confirmation_fee_inr column for partial-prepaid COD orders.
--
-- Background: replaces the manual /cod phone-verification flow. Customers
-- picking "Pay X now and rest Cash on Delivery" pay 10% of subtotal upfront
-- via Razorpay (clamped ₹100-₹300, rounded up to ₹50). That amount is stored
-- here so Shiprocket can be told to collect (total - confirmation_fee) at
-- the door instead of the full total.
--
-- Safe to deploy live: column is additive with default 0. All historical rows
-- and any in-flight prepaid / pre-cutover COD order keep their meaning.

ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "confirmation_fee_inr" integer NOT NULL DEFAULT 0;
