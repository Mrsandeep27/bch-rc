"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, User, AlertCircle, Eye, EyeOff } from "lucide-react";

/**
 * Operator login form for the COD verification console.
 *
 * Rendered inline by /cod when the request has no valid cod-session cookie,
 * and also at the standalone /cod/login URL. Inline rendering deliberately
 * avoids a server-side redirect() throw — Next.js's framework redirect can
 * collide with custom error boundaries and surface as the generic error
 * page instead of an actual 307. Rendering the form directly is both
 * simpler and more reliable.
 */
export function CodLoginForm() {
  const router = useRouter();
  const [username, setUsername] = useState("cod");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 15_000);
    try {
      const res = await fetch("/api/cod/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
        signal: ac.signal,
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Sign-in failed");
        setLoading(false);
        return;
      }
      // Hard-refresh into /cod so the server re-renders with the new
      // cod-session cookie and shows the pending-orders dashboard.
      router.push("/cod");
      router.refresh();
      setLoading(false);
    } catch (err) {
      const msg =
        err instanceof DOMException && err.name === "AbortError"
          ? "Sign-in is taking longer than expected — tap Sign in to retry."
          : err instanceof Error
            ? err.message
            : String(err);
      setError(msg);
      setLoading(false);
    } finally {
      clearTimeout(t);
    }
  }

  return (
    <div className="min-h-screen bg-[#0b0b0c] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="font-display text-3xl font-bold text-white">
            PRC Cars <span className="text-brand-red">COD Console</span>
          </h1>
          <p className="text-sm text-white/60 mt-2">
            Call-and-confirm pending Cash-on-Delivery orders.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-2xl p-6 sm:p-8 space-y-4"
        >
          <div>
            <label
              htmlFor="username"
              className="block text-xs font-mono font-bold uppercase tracking-widest text-brand-ink-soft mb-2"
            >
              Username
            </label>
            <div className="relative">
              <User
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-ink-soft pointer-events-none"
              />
              <input
                id="username"
                type="text"
                required
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
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
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
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
            disabled={loading}
            className="w-full bg-brand-ink hover:bg-brand-ink-soft text-white py-3 rounded-lg font-bold disabled:opacity-50 transition-colors"
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
