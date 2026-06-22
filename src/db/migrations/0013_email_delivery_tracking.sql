-- Email delivery tracking — record whether a confirmation actually reached the
-- customer, not just that we handed it to Resend.
--
-- Background: order PRC-QP2W7BAB's confirmation bounced (recipient inbox full)
-- but our DB showed it "sent" with no error, because we only tracked sent_at.
-- These columns + the /api/webhooks/resend receiver give us a real record of
-- delivered / bounced / complained so ops can follow up by phone.
--
-- Safe live deploy: additive; delivery_status defaults to 'pending'.

ALTER TABLE "notifications_outbox" ADD COLUMN IF NOT EXISTS "provider_id" text;
ALTER TABLE "notifications_outbox" ADD COLUMN IF NOT EXISTS "delivery_status" text NOT NULL DEFAULT 'pending';
ALTER TABLE "notifications_outbox" ADD COLUMN IF NOT EXISTS "delivery_status_at" timestamptz;

-- Backfill: rows we already sent are at least 'sent' (we just can't know if
-- they bounced retroactively — only new ones get full delivery tracking).
UPDATE "notifications_outbox"
SET "delivery_status" = 'sent'
WHERE "sent_at" IS NOT NULL AND "delivery_status" = 'pending';
