/**
 * POST /api/pack/login — employee login for the packing console.
 *
 * Mirrors /api/cod/login. Credentials in env (PACK_USERNAME, PACK_PASSWORD).
 * On success a signed httpOnly cookie is set; /pack RSC pages gate on it
 * via isPackAuthenticated. Rate-limited per IP.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import {
  checkPackCredentials,
  mintPackSessionToken,
  PACK_COOKIE_NAME,
  PACK_SESSION_MS,
} from "@/lib/pack-auth";
import { checkLimits } from "@/lib/rate-limit";

const Body = z.object({
  username: z.string().min(1).max(40),
  password: z.string().min(1).max(120),
});

const RL_WINDOW_MS = 15 * 60 * 1000;
const RL_PER_IP = 20;

function clientIp(req: Request): string {
  const first = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (first) return first;
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}

export async function POST(req: Request) {
  const ip = clientIp(req);
  const rl = checkLimits("pack:login", Date.now(), [
    { key: `pack-login:ip:${ip}`, limit: RL_PER_IP, windowMs: RL_WINDOW_MS, dimension: "ip" },
  ]);
  if (rl.blocked) {
    return NextResponse.json(
      { error: "Too many attempts. Try again in a few minutes." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const check = checkPackCredentials(body.username, body.password);
  if (!check.ok) {
    if (check.reason === "MISSING_ENV") {
      return NextResponse.json(
        { error: "Pack console not configured. Set PACK_PASSWORD and PACK_SESSION_SECRET." },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: "Invalid username or password." }, { status: 401 });
  }

  const { token } = mintPackSessionToken();
  const res = NextResponse.json({ ok: true });
  res.cookies.set({
    name: PACK_COOKIE_NAME,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: Math.floor(PACK_SESSION_MS / 1000),
  });
  return res;
}
