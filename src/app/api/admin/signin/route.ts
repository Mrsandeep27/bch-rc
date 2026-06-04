/**
 * POST /api/admin/signin
 *
 * Email + password admin sign-in. Auto-creates the auth.users row on first
 * sign-in IF the email is in ADMIN_FOUNDER_EMAILS — meaning a founder can
 * just type their email + chosen password the first time and it Just Works.
 *
 * After that, password is fixed (use Supabase dashboard to reset).
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import {
  resolveAdmin,
  FOUNDER_BOOTSTRAP_ENABLED,
  type AdminContext,
} from "@/lib/admin-auth";
import { DatabaseUnavailableError } from "@/db";
import { checkLimits } from "@/lib/rate-limit";
import { logError } from "@/lib/logger";

const FOUNDER_EMAILS = (process.env.ADMIN_FOUNDER_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

const Body = z.object({
  email: z.string().email().transform((s) => s.toLowerCase()),
  password: z.string().min(8, "Password must be 8+ chars"),
});

// PHASE 2 — brute-force / credential-stuffing / founder-abuse limits.
const RL_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const RL_PER_EMAIL = 5;
const RL_PER_IP = 20;

function clientIp(req: Request): string {
  const first = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (first) return first;
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}

function tooManyResponse(retryAfterSec: number): NextResponse {
  return NextResponse.json(
    { error: "Too many login attempts. Try again later." },
    { status: 429, headers: { "Retry-After": String(retryAfterSec) } },
  );
}

function serviceUnavailableResponse(): NextResponse {
  return NextResponse.json(
    {
      error:
        "Admin service is temporarily unavailable. Please try again in a few minutes.",
    },
    { status: 503, headers: { "Retry-After": "30" } },
  );
}

/**
 * PHASE 5 — authorize, distinguishing a real DB outage (503, keep the user on
 * the login page) from "not an admin" (null → 403). Never leaks stack traces.
 */
async function authorize(user: {
  id: string;
  email: string;
  name: string | null;
}): Promise<{ ok: true; ctx: AdminContext | null } | { ok: false }> {
  try {
    return { ok: true, ctx: await resolveAdmin(user) };
  } catch (err) {
    if (err instanceof DatabaseUnavailableError) {
      logError("admin:signin", err, { stage: "authorize" });
      return { ok: false };
    }
    throw err;
  }
}

export async function POST(req: Request) {
  const now = Date.now();
  const ip = clientIp(req);

  // PHASE 2a — IP throttle first, so malformed-body floods are also capped.
  const ipLimit = checkLimits("admin:signin", now, [
    { key: `signin:ip:${ip}`, limit: RL_PER_IP, windowMs: RL_WINDOW_MS, dimension: "ip" },
  ]);
  if (ipLimit.blocked) return tooManyResponse(ipLimit.retryAfterSec);

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch {
    return NextResponse.json(
      { error: "Invalid email or password format" },
      { status: 400 },
    );
  }

  // PHASE 2b — per-email throttle (brute force / founder-email abuse).
  const emailLimit = checkLimits("admin:signin", now, [
    {
      key: `signin:email:${body.email}`,
      limit: RL_PER_EMAIL,
      windowMs: RL_WINDOW_MS,
      dimension: "email",
    },
  ]);
  if (emailLimit.blocked) return tooManyResponse(emailLimit.retryAfterSec);

  const supabase = await createClient();

  // 1. Try normal sign-in first.
  const { data: signInData, error: signInError } =
    await supabase.auth.signInWithPassword({
      email: body.email,
      password: body.password,
    });

  if (!signInError && signInData.session) {
    // Authentication succeeded. Now AUTHORIZE in the same request: the user
    // must be an active admin (or a bootstrappable founder). Returning ok:true
    // here without this check is what left non-admins authenticated-but-
    // unauthorized — the layout would then redirect them back to /admin/login
    // and the button froze on "Signing in…" forever.
    const authz = await authorize({
      id: signInData.user.id,
      email: body.email,
      name: (signInData.user.user_metadata?.name as string) || null,
    });
    if (!authz.ok) {
      // DB outage during authorization — don't strand the user as
      // "unauthorized"; tell them to retry shortly.
      await supabase.auth.signOut();
      return serviceUnavailableResponse();
    }
    if (!authz.ctx) {
      // Clear the session cookie we just set so we don't leave the browser
      // half-logged-in (authenticated but unable to enter /admin).
      await supabase.auth.signOut();
      return NextResponse.json(
        { error: "This account is not authorized for admin access." },
        { status: 403 },
      );
    }
    return NextResponse.json({ ok: true, created: false });
  }

  // 2. Sign-in failed. If this is a founder email, auto-create the user
  // with the supplied password and try again.
  if (!FOUNDER_EMAILS.includes(body.email)) {
    return NextResponse.json(
      { error: "Invalid email or password." },
      { status: 401 },
    );
  }

  // PHASE 3 — founder auto-creation is a one-time setup mechanism, gated by
  // ALLOW_FOUNDER_BOOTSTRAP. When disabled, never create users; return 403.
  if (!FOUNDER_BOOTSTRAP_ENABLED) {
    return NextResponse.json(
      {
        error:
          "Admin bootstrap is disabled. Contact an existing owner to be added.",
      },
      { status: 403 },
    );
  }

  // Founder: create the auth user (idempotent — if it exists, we'll catch).
  const admin = createAdminClient();
  const { error: createError } = await admin.auth.admin.createUser({
    email: body.email,
    password: body.password,
    email_confirm: true,
  });

  if (createError && !createError.message.toLowerCase().includes("already")) {
    return NextResponse.json(
      { error: `Could not create admin: ${createError.message}` },
      { status: 500 },
    );
  }

  // If the user already existed, the password was wrong. Tell them.
  if (createError) {
    return NextResponse.json(
      {
        error:
          "Account exists but password didn't match. Reset password from Supabase dashboard.",
      },
      { status: 401 },
    );
  }

  // 3. Now sign in with the freshly created user.
  const { data: retryData, error: retryError } =
    await supabase.auth.signInWithPassword({
      email: body.email,
      password: body.password,
    });

  if (retryError || !retryData.session) {
    return NextResponse.json(
      {
        error: `Sign-in failed after account create: ${
          retryError?.message ?? "no session"
        }`,
      },
      { status: 500 },
    );
  }

  // Bootstrap + authorize the freshly created founder. resolveAdmin provisions
  // the OWNER admins row on first sign-in. If it still can't be resolved,
  // don't leave them authenticated-but-unauthorized.
  const authz = await authorize({
    id: retryData.user.id,
    email: body.email,
    name: (retryData.user.user_metadata?.name as string) || null,
  });
  if (!authz.ok) {
    await supabase.auth.signOut();
    return serviceUnavailableResponse();
  }
  if (!authz.ctx) {
    await supabase.auth.signOut();
    return NextResponse.json(
      { error: "Account created but admin provisioning failed." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, created: true });
}
