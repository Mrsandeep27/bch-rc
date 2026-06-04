-- COD call-before-confirm gate.
--
-- Adds a new order status `PENDING_COD_VERIFICATION` that sits ahead of PAID
-- on the COD path. Customer places COD → status lands here → the operator at
-- /cod calls them, then clicks Confirm (→ PAID, shipment created) or Reject
-- (→ CANCELLED, inventory released). A 48h sweeper auto-rejects anything left
-- hanging. Kills the "kids placing fake COD orders" problem.
--
-- Prepaid orders are untouched — they still go PENDING → PAID on capture.

ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'PENDING_COD_VERIFICATION';
