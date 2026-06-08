/**
 * Lightweight cookie-based auth for the /pack packing-employee console.
 *
 * Mirrors the /cod auth pattern. Intentionally separate from /admin (Supabase)
 * AND from /cod (call operator) so the packing employee gets only the surface
 * they need — list of orders to pack, print buttons — without seeing customer
 * PII, refunds, inventory, or COD verification queue.
 *
 * Env contract:
 *   PACK_USERNAME        — login name (default: "pack")
 *   PACK_PASSWORD        — shared secret, env-only
 *   PACK_SESSION_SECRET  — 32+ hex chars for HMAC-signing the session cookie
 *
 * Token format identical to /cod: base64url(payload).base64url(hmac), payload
 * = {exp, n}. 12-hour sessions. Logout clears the cookie.
 */

import { createHmac, timingSafeEqual, randomBytes } from "node:crypto";
import { cookies } from "next/headers";

const COOKIE_NAME = "pack-session";
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
  const s = process.env.PACK_SESSION_SECRET;
  if (!s || s.length < 32) {
    throw new Error(
      "PACK_SESSION_SECRET is not set (need at least 32 chars). Generate with `openssl rand -hex 32`.",
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

export type PackCredentialCheck =
  | { ok: true }
  | { ok: false; reason: "MISSING_ENV" | "BAD_CREDENTIALS" };

export function checkPackCredentials(
  username: string,
  password: string,
): PackCredentialCheck {
  const expectedUser = process.env.PACK_USERNAME ?? "pack";
  const expectedPass = process.env.PACK_PASSWORD;
  if (!expectedPass) {
    return { ok: false, reason: "MISSING_ENV" };
  }
  const userOk = safeEq(username, expectedUser);
  const passOk = safeEq(password, expectedPass);
  if (userOk && passOk) return { ok: true };
  return { ok: false, reason: "BAD_CREDENTIALS" };
}

export function mintPackSessionToken(): { token: string; expiresAt: Date } {
  const exp = Date.now() + SESSION_MS;
  const payload = JSON.stringify({ exp, n: b64urlEncode(randomBytes(6)) });
  const payloadB64 = b64urlEncode(Buffer.from(payload));
  const token = `${payloadB64}.${sign(payloadB64)}`;
  return { token, expiresAt: new Date(exp) };
}

export function verifyPackSessionToken(token: string | undefined): boolean {
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

export const PACK_COOKIE_NAME = COOKIE_NAME;
export const PACK_SESSION_MS = SESSION_MS;

export async function isPackAuthenticated(): Promise<boolean> {
  const store = await cookies();
  const c = store.get(COOKIE_NAME);
  return verifyPackSessionToken(c?.value);
}
