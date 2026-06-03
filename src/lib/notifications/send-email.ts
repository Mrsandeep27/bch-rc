/**
 * Resend wrapper. Returns ok=true on accepted, ok=false + reason on rejection.
 * Does NOT throw on Resend API errors — the cron worker catches and bumps
 * the retry counter.
 */

const RESEND_ENDPOINT = "https://api.resend.com/emails";

export type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
  /**
   * Forwarded to Resend as its `Idempotency-Key` header. If the same key is
   * submitted twice (e.g. an inline send racing the cron drain), Resend returns
   * the original send instead of dispatching a second email. Belt-and-suspenders
   * on top of our outbox dedup_key + row lease.
   */
  idempotencyKey?: string;
};

const FROM_DEFAULT = "PRC Cars <orders@pocketrccars.com>";

export async function sendEmail(
  input: SendEmailInput,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { ok: false, error: "RESEND_API_KEY not set" };
  }

  const body = {
    from: process.env.RESEND_FROM || FROM_DEFAULT,
    to: [input.to],
    subject: input.subject,
    html: input.html,
    text: input.text,
    reply_to: input.replyTo ?? "support@pocketrccars.com",
  };

  let res: Response;
  try {
    res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        ...(input.idempotencyKey
          ? { "Idempotency-Key": input.idempotencyKey }
          : {}),
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10000),
    });
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return {
      ok: false,
      error: `Resend ${res.status}: ${text.slice(0, 200)}`,
    };
  }

  const data = (await res.json().catch(() => ({}))) as { id?: string };
  return { ok: true, id: data.id ?? "unknown" };
}
