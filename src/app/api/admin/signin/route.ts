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

const FOUNDER_EMAILS = (process.env.ADMIN_FOUNDER_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

const Body = z.object({
  email: z.string().email().transform((s) => s.toLowerCase()),
  password: z.string().min(8, "Password must be 8+ chars"),
});

export async function POST(req: Request) {
  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch (err) {
    return NextResponse.json(
      { error: "Invalid email or password format" },
      { status: 400 },
    );
  }

  const supabase = await createClient();

  // 1. Try normal sign-in first.
  const { data: signInData, error: signInError } =
    await supabase.auth.signInWithPassword({
      email: body.email,
      password: body.password,
    });

  if (!signInError && signInData.session) {
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
  const { error: retryError } = await supabase.auth.signInWithPassword({
    email: body.email,
    password: body.password,
  });

  if (retryError) {
    return NextResponse.json(
      { error: `Sign-in failed after account create: ${retryError.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, created: true });
}
