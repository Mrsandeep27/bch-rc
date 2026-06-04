-- Seed the CODEPRC100 first-order coupon that the storefront auto-suggests
-- via AUTO_COUPON in src/lib/config.ts. Before this migration the chip on
-- /checkout always returned "Coupon not found" because the row was missing.
--
-- - type: FLAT_INR
-- - value: 100   (rupees off — applies before tax/shipping)
-- - min_order_inr: 0   (any cart qualifies; the customer-facing copy gates this)
-- - per_customer_limit: 1   (truly "first order" — one redemption per customer)
-- - site_id: 'prc'   (scoped to the PRC site; doesn't leak to other tenants)
-- - active: true
-- - valid_from: now()   (live immediately on deploy)
-- - valid_to: NULL   (no end date — managed by flipping active or by hand)
--
-- Idempotent: ON CONFLICT (site_id, code) DO NOTHING preserves any manual
-- edits made later (used_count, expiry) on a re-run.

INSERT INTO coupons (
  site_id,
  code,
  type,
  value,
  min_order_inr,
  per_customer_limit,
  active,
  valid_from
)
VALUES (
  'prc',
  'CODEPRC100',
  'FLAT_INR',
  100,
  0,
  1,
  true,
  now()
)
ON CONFLICT (site_id, code) DO NOTHING;
