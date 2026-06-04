/**
 * POST /api/cod/login — operator login for the COD verification console.
 *
 * Credentials live in env (COD_USERNAME, COD_PASSWORD). On success a signed
 * httpOnly cookie is set; the /cod RSC pages gate on it via isCodAuthenticated.
 * Rate-limited per IP so a bored kid can't grind the password.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import {
  checkCodCredentials,
  mintCodSessionToken,
  COD_COOKIE_NAME,
  COD_SESSION_MS,
} from "@/lib/cod-auth";
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
  const rl = checkLimits("cod:login", Date.now(), [
    { key: `cod-login:ip:${ip}`, limit: RL_PER_IP, windowMs: RL_WINDOW_MS, dimension: "ip" },
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

  const check = checkCodCredentials(body.username, body.password);
  if (!check.ok) {
    if (check.reason === "MISSING_ENV") {
      return NextResponse.json(
        { error: "COD console not configured. Set COD_PASSWORD and COD_SESSION_SECRET." },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: "Invalid username or password." }, { status: 401 });
  }

  const { token } = mintCodSessionToken();
  const res = NextResponse.json({ ok: true });
  res.cookies.set({
    name: COD_COOKIE_NAME,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: Math.floor(COD_SESSION_MS / 1000),
  });
  return res;
}
