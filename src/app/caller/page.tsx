/**
 * Caller desk (/caller) — a password-gated recovery view for a phone agent.
 *
 * Access: a single shared password (CALLER_DESK_PASSWORD, default "Caller123").
 * The caller opens /caller, logs in, and sees ONLY the callable abandoned-cart
 * list (names + phones + items) across all active sites — never revenue,
 * orders, inventory or settings. Deliberately NOT the founder admin login.
 *
 * A correct password sets an httpOnly cookie holding an opaque session marker;
 * the page re-checks that cookie on every load. Change CALLER_DESK_PASSWORD to
 * rotate the password. noindex + force-dynamic.
 */

import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { LifeBuoy, LogIn, LogOut } from "lucide-react";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { sites } from "@/db/schema";
import { recoverCapturedPayments } from "@/lib/reconcile";
import { getRecoverableCarts, MIN_AGE_MIN } from "@/lib/recovery";
import { RecoveryList } from "@/components/RecoveryList";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false } };

const COOKIE = "caller_session";
const password = () => process.env.CALLER_DESK_PASSWORD || "Caller123";
// Opaque marker stored in the cookie so a login can be verified without keeping
// the password in the cookie. Reuses CALLER_DESK_TOKEN if set, else a constant.
const sessionValue = () => process.env.CALLER_DESK_TOKEN || "caller-desk-ok";

async function login(formData: FormData) {
  "use server";
  const pw = String(formData.get("password") ?? "");
  if (pw !== password()) redirect("/caller?e=1");
  const jar = await cookies();
  jar.set(COOKIE, sessionValue(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/caller",
    maxAge: 60 * 60 * 12, // 12h shift
  });
  redirect("/caller");
}

async function logout() {
  "use server";
  const jar = await cookies();
  jar.delete(COOKIE);
  redirect("/caller");
}

export default async function CallerPage({
  searchParams,
}: {
  searchParams: Promise<{ e?: string }>;
}) {
  const jar = await cookies();
  const authed = jar.get(COOKIE)?.value === sessionValue();

  if (!authed) {
    const { e } = await searchParams;
    return <LoginForm error={!!e} />;
  }

  // Money-truth first: flip any just-paid order to PAID so we never call
  // someone who already bought. Best-effort.
  await recoverCapturedPayments(50, 30 * 60 * 1000).catch(() => {});

  const activeSites = await db
    .select({ id: sites.id })
    .from(sites)
    .where(eq(sites.active, true));
  const data = await getRecoverableCarts(activeSites.map((s) => s.id));
  const nowMs = new Date().getTime();

  return (
    <main className="min-h-screen bg-brand-cream">
      <div className="mx-auto max-w-3xl px-4 py-6 sm:py-8 space-y-6">
        <header className="flex items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-brand-ink flex items-center gap-2">
              <LifeBuoy size={24} className="text-brand-red" /> Caller desk
            </h1>
            <p className="text-sm text-brand-ink-soft mt-1">
              Everyone who started but didn&apos;t finish an order. Tap{" "}
              <span className="font-semibold">Call</span> to phone them or{" "}
              <span className="font-semibold">Nudge</span> to open WhatsApp with
              a ready message. New drop-offs appear after {MIN_AGE_MIN} min;
              anyone who has since paid drops off automatically. Refresh to
              update.
            </p>
          </div>
          <form action={logout}>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 text-sm text-brand-ink-soft hover:text-brand-ink px-3 py-2 rounded-full border border-brand-line shrink-0"
            >
              <LogOut size={14} /> Log out
            </button>
          </form>
        </header>

        <RecoveryList data={data} nowMs={nowMs} />
      </div>
    </main>
  );
}

function LoginForm({ error }: { error: boolean }) {
  return (
    <main className="min-h-screen grid place-items-center bg-brand-cream px-4">
      <form
        action={login}
        className="w-full max-w-sm bg-white rounded-2xl border border-brand-line p-6 space-y-4"
      >
        <h1 className="font-display text-xl font-bold text-brand-ink flex items-center gap-2">
          <LifeBuoy size={22} className="text-brand-red" /> Caller desk
        </h1>
        <p className="text-sm text-brand-ink-soft">
          Enter the caller password to see who to call.
        </p>
        {error && (
          <p className="text-sm text-brand-red font-medium">
            Wrong password — try again.
          </p>
        )}
        <input
          type="password"
          name="password"
          required
          autoFocus
          autoComplete="current-password"
          placeholder="Password"
          className="w-full rounded-xl border border-brand-line px-4 py-3 text-brand-ink outline-none focus:border-brand-ink"
        />
        <button
          type="submit"
          className="w-full inline-flex items-center justify-center gap-2 bg-brand-red hover:opacity-90 text-white px-4 py-3 rounded-xl font-semibold transition-opacity"
        >
          <LogIn size={16} /> Log in
        </button>
      </form>
    </main>
  );
}
