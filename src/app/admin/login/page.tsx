"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, Mail, AlertCircle, Eye, EyeOff } from "lucide-react";
import { THEME } from "@/lib/theme";

export default function AdminLogin() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    // Hard ceiling on the request. Without this the UI can sit on
    // "Signing in…" forever if Vercel cold-starts past the function timeout,
    // Supabase Auth stalls, or any intermediate hop drops the connection.
    // 15 s is comfortably above worst-case cold-start (~3-5 s) + a single
    // Supabase round-trip from Mumbai (<100 ms), so a normal sign-in will
    // never trip it, but a true hang now surfaces an actionable error
    // instead of a stuck button.
    const ac = new AbortController();
    const timeoutId = setTimeout(() => ac.abort(), 15_000);

    try {
      const res = await fetch("/api/admin/signin", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password,
        }),
        signal: ac.signal,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Sign-in failed");
        setLoading(false);
        return;
      }
      if (data.created) {
        setCreated(true);
        // `created` now drives the button (disabled + "redirecting…" label),
        // so the loading flag can be released here. Brief pause for the user
        // to see "Account created" then redirect.
        setLoading(false);
        setTimeout(() => router.push("/admin"), 600);
        return;
      }
      router.push("/admin");
      router.refresh();
      // Defensive: navigation is async and the login route is outside the
      // (authed) group, so a successful sign-in genuinely leaves this page.
      // But if navigation is ever interrupted (an unexpected bounce, a slow
      // RSC render), never leave the button frozen on "Signing in…".
      setLoading(false);
    } catch (err) {
      // AbortError fires from our own timeout — translate it to a friendly
      // retryable message instead of "The user aborted a request."
      const msg =
        err instanceof DOMException && err.name === "AbortError"
          ? "Sign-in is taking longer than expected. Tap Sign in to retry."
          : err instanceof Error
            ? err.message
            : String(err);
      setError(msg);
      setLoading(false);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  return (
    <div className="min-h-screen bg-brand-ink flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="font-display text-3xl font-bold text-white">
            {THEME.brandName}{" "}
            <span className="text-brand-red">Admin</span>
          </h1>
          <p className="text-sm text-white/60 mt-2">
            Sign in to manage orders, customers, and sites.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-2xl p-6 sm:p-8 space-y-4"
        >
          <div>
            <label
              htmlFor="email"
              className="block text-xs font-mono font-bold uppercase tracking-widest text-brand-ink-soft mb-2"
            >
              Email
            </label>
            <div className="relative">
              <Mail
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-ink-soft pointer-events-none"
              />
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full pl-9 pr-3 py-3 rounded-lg border-2 border-brand-line focus:border-brand-red focus:outline-none text-brand-ink"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-xs font-mono font-bold uppercase tracking-widest text-brand-ink-soft mb-2"
            >
              Password
            </label>
            <div className="relative">
              <Lock
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-ink-soft pointer-events-none"
              />
              <input
                id="password"
                type={showPwd ? "text" : "password"}
                required
                minLength={8}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="8+ characters"
                className="w-full pl-9 pr-10 py-3 rounded-lg border-2 border-brand-line focus:border-brand-red focus:outline-none text-brand-ink"
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowPwd((s) => !s)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-brand-ink-soft hover:text-brand-ink"
                aria-label={showPwd ? "Hide password" : "Show password"}
              >
                {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {error && (
            <p className="inline-flex items-center gap-1.5 text-sm text-brand-red font-medium">
              <AlertCircle size={14} />
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || created}
            className="w-full bg-brand-ink hover:bg-brand-ink-soft text-white py-3 rounded-lg font-bold disabled:opacity-50 transition-colors"
          >
            {created
              ? "Account created — redirecting..."
              : loading
                ? "Signing in..."
                : "Sign in"}
          </button>

          <p className="text-xs text-brand-ink-soft text-center leading-relaxed">
            First time? Type your email + your chosen password.
            <br />
            If your email is in the founder allowlist, we&apos;ll create your
            account on the spot.
          </p>
        </form>
      </div>
    </div>
  );
}
