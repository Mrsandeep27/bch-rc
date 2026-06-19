-- Add invoice_number for the Zoho Books GST invoice number.
--
-- Background: per Syed (2026-06-19), GST invoices are generated in Zoho Books
-- (multi-platform billing pool), so the tax invoice number comes FROM Zoho and
-- is entered per order. Order ID stays the reference id; this column holds the
-- taxation document number. Nullable until an operator enters it on
-- /pack/invoice/[id].
--
-- Safe live deploy: additive, nullable, no default needed.

ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "invoice_number" text;
