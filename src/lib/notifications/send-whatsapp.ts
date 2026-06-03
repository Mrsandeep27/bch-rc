/**
 * WhatsApp transport seam. Mirrors send-email.ts so the outbox/drain machinery
 * can dispatch a row to WhatsApp identically to email.
 *
 * Provider-agnostic: it POSTs the rendered text to a generic WhatsApp Business
 * API endpoint configured via env. Until DLT/BSP onboarding is complete the
 * env vars are unset and rows are never enqueued for this channel (see
 * notify.ts → whatsappEnabled), so this never runs in prod by accident.
 *
 * Required env when enabling:
 *   WHATSAPP_ENABLED=true
 *   WHATSAPP_API_URL=https://graph.facebook.com/v21.0/<phone_number_id>/messages
 *   WHATSAPP_API_TOKEN=<permanent access token>
 */

const TIMEOUT_MS = 10_000;

export async function sendWhatsApp(input: {
  toPhone: string;
  text: string;
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const apiUrl = process.env.WHATSAPP_API_URL;
  const token = process.env.WHATSAPP_API_TOKEN;

  if (!apiUrl || !token) {
    return { ok: false, error: "WhatsApp transport not configured" };
  }
  if (!input.toPhone) {
    return { ok: false, error: "Missing destination phone" };
  }

  // Normalise to digits with country code (India default when 10 digits).
  const digits = input.toPhone.replace(/\D/g, "");
  const to = digits.length === 10 ? `91${digits}` : digits;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(apiUrl, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "text",
        text: { preview_url: true, body: input.text },
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return { ok: false, error: `WhatsApp API ${res.status}: ${detail.slice(0, 200)}` };
    }
    const data = (await res.json().catch(() => ({}))) as {
      messages?: Array<{ id?: string }>;
    };
    return { ok: true, id: data.messages?.[0]?.id ?? "sent" };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  } finally {
    clearTimeout(timer);
  }
}
