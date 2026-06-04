/**
 * Lightweight cookie-based auth for the /cod operator console.
 *
 * Intentionally separate from /admin (Supabase Auth) so the COD shift can be
 * handed to a family member with a single shared username/password — no
 * Supabase user row, no admin DB access, no risk of accidentally giving them
 * the keys to inventory/refunds/customer data.
 *
 * Env contract:
 *   COD_USERNAME        — login name (default: "cod")
 *   COD_PASSWORD        — shared secret in plain text (env-only, never bundled)
 *   COD_SESSION_SECRET  — 32+ hex chars used to HMAC-sign the session cookie
 *
 * Token format: base64url(payload).base64url(hmac), where payload is
 * `{exp: ms-epoch}`. Sessions live 12 hours. The HMAC + timing-safe compare
 * is the only check needed — there's no DB row to revoke against. Logout
 * simply clears the cookie.
 */

import { createHmac, timingSafeEqual, randomBytes } from "node:crypto";
import { cookies } from "next/headers";

const COOKIE_NAME = "cod-session";
const SESSION_MS = 12 * 60 * 60 * 1000;

function b64urlEncode(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function b64urlDecode(s: string): Buffer {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
}

function getSecret(): string {
  const s = process.env.COD_SESSION_SECRET;
  if (!s || s.length < 32) {
    throw new Error(
      "COD_SESSION_SECRET is not set (need at least 32 chars). Generate with `openssl rand -hex 32`.",
    );
  }
  return s;
}

function sign(payload: string): string {
  const hmac = createHmac("sha256", getSecret()).update(payload).digest();
  return b64urlEncode(hmac);
}

function safeEq(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export type CodCredentialCheck =
  | { ok: true }
  | { ok: false; reason: "MISSING_ENV" | "BAD_CREDENTIALS" };

/**
 * Verify the operator's login form payload against env credentials. Uses a
 * timing-safe compare on both fields so a wrong-username response is
 * indistinguishable from a wrong-password response.
 */
export function checkCodCredentials(
  username: string,
  password: string,
): CodCredentialCheck {
  const expectedUser = process.env.COD_USERNAME ?? "cod";
  const expectedPass = process.env.COD_PASSWORD;
  if (!expectedPass) {
    return { ok: false, reason: "MISSING_ENV" };
  }
  const userOk = safeEq(username, expectedUser);
  const passOk = safeEq(password, expectedPass);
  if (userOk && passOk) return { ok: true };
  return { ok: false, reason: "BAD_CREDENTIALS" };
}

/** Mint a fresh session token. Caller writes it into the cookie. */
export function mintCodSessionToken(): { token: string; expiresAt: Date } {
  const exp = Date.now() + SESSION_MS;
  // Pad with a small random nonce so two tokens minted in the same
  // millisecond aren't byte-identical — purely cosmetic but keeps cookies
  // out of the "easy to fingerprint" bucket.
  const payload = JSON.stringify({ exp, n: b64urlEncode(randomBytes(6)) });
  const payloadB64 = b64urlEncode(Buffer.from(payload));
  const token = `${payloadB64}.${sign(payloadB64)}`;
  return { token, expiresAt: new Date(exp) };
}

export function verifyCodSessionToken(token: string | undefined): boolean {
  if (!token) return false;
  const dot = token.indexOf(".");
  if (dot <= 0) return false;
  const payloadB64 = token.slice(0, dot);
  const sigB64 = token.slice(dot + 1);
  const expected = sign(payloadB64);
  if (!safeEq(expected, sigB64)) return false;
  try {
    const payload = JSON.parse(b64urlDecode(payloadB64).toString()) as {
      exp?: number;
    };
    if (typeof payload.exp !== "number") return false;
    return payload.exp > Date.now();
  } catch {
    return false;
  }
}

export const COD_COOKIE_NAME = COOKIE_NAME;
export const COD_SESSION_MS = SESSION_MS;

/**
 * Server-side gate for /cod pages and actions. Returns true if the cookie
 * is present, signed, and unexpired.
 */
export async function isCodAuthenticated(): Promise<boolean> {
  const store = await cookies();
  const c = store.get(COOKIE_NAME);
  return verifyCodSessionToken(c?.value);
}
