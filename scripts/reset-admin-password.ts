/**
 * Reset (or create) a founder-admin password without going through the
 * Supabase dashboard.
 *
 * Usage:
 *   npm run admin:reset-password -- founder@example.com NewStrongPassword123
 *
 * Requirements:
 *   - .env.local must have NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
 *   - The email must be in ADMIN_FOUNDER_EMAILS (we refuse to touch anything
 *     outside the allowlist to avoid trivial misuse)
 *
 * Behaviour:
 *   - If the user exists, updates their password.
 *   - If the user does NOT exist, creates them with email_confirmed=true and
 *     the supplied password.
 *   - Prints a single success line. Exit code 0 on success, 1 on any failure.
 *
 * This is deliberately a CLI tool (not an HTTP endpoint). HTTP-based admin
 * password reset would mean anyone who learns a founder email + the endpoint
 * URL can take over the account. A CLI tool gated by the service-role key
 * (which lives only in .env.local + Vercel encrypted env) is much safer.
 */

import { createClient } from "@supabase/supabase-js";

async function main() {
  const [, , rawEmail, rawPassword] = process.argv;

  if (!rawEmail || !rawPassword) {
    console.error(
      "Usage: npm run admin:reset-password -- <email> <new-password>",
    );
    process.exit(1);
  }

  const email = rawEmail.trim().toLowerCase();
  const password = rawPassword;

  const founders = (process.env.ADMIN_FOUNDER_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  if (!founders.includes(email)) {
    console.error(
      `Refusing to reset: ${email} is not in ADMIN_FOUNDER_EMAILS.`,
    );
    console.error(`Allowed: ${founders.join(", ") || "(empty)"}`);
    process.exit(1);
  }

  if (password.length < 8) {
    console.error("Password must be at least 8 characters.");
    process.exit(1);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRole) {
    console.error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env.",
    );
    process.exit(1);
  }

  const admin = createClient(url, serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Paginate listUsers in case the project ever grows beyond the default page.
  // For a single-operator admin set this typically returns in one call.
  let existing: { id: string; email?: string | null } | null = null;
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error) {
      console.error(`listUsers failed: ${error.message}`);
      process.exit(1);
    }
    existing =
      data.users.find((u) => u.email?.toLowerCase() === email) ?? null;
    if (existing) break;
    if (data.users.length < 200) break; // no more pages
  }

  if (existing) {
    const { error } = await admin.auth.admin.updateUserById(existing.id, {
      password,
      email_confirm: true,
    });
    if (error) {
      console.error(`updateUserById failed: ${error.message}`);
      process.exit(1);
    }
    console.log(`Password reset for ${email} (id=${existing.id}).`);
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error) {
      console.error(`createUser failed: ${error.message}`);
      process.exit(1);
    }
    console.log(`Created ${email} (id=${data.user?.id}).`);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error("reset-admin-password crashed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
