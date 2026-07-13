"use client";

/**
 * "Name your price" — the exit-intent haggle game. The buyer guesses a price
 * against a HIDDEN floor (owned entirely by /api/bargain/offer); a guess at or
 * above the floor wins at their number, mints a single-use coupon BOUND to that
 * exact car, and drops them straight into the pay flow with it pre-applied.
 * Nothing here trusts the client: the modal only shows the sticker price, sends
 * guesses, and renders whatever the server grades back.
 *
 * Two timers, on purpose:
 *   - uiEndsAtMs  → the 5-minute urgency countdown the buyer SEES.
 *   - expiresAtMs → the real coupon lifetime (grace window), longer, so a slow
 *                   payment gateway can't void a legitimately-won price.
 *
 * Visual language matches HubSpinWheel (dark glass, brand-red, race copy).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { X, Zap, PartyPopper, Sparkles, ArrowUp, Target, Check, Hourglass, Tag, Lock, type LucideIcon } from "lucide-react";
import { trackFunnel } from "@/lib/funnel-client";
import { BARGAIN } from "@/lib/config";

export type BargainTarget = {
  skuId: string;
  name: string;
  image?: string | null;
  listInr: number;
};

type ServerResult = {
  ok: boolean;
  disabled?: boolean;
  error?: string;
  state?: "active" | "won" | "lost" | "cooldown" | "expired";
  listInr?: number;
  attemptsLeft?: number;
  heat?: "close" | "low";
  wonPriceInr?: number;
  discountInr?: number;
  couponCode?: string;
  expiresAtMs?: number;
  uiEndsAtMs?: number;
};

const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

// Deliberately vague — game-like, but no precise distance to binary-search.
const HEAT: Record<string, { Icon: LucideIcon; text: string }> = {
  close: { Icon: Target, text: "Almost there — nudge it up." },
  low: { Icon: ArrowUp, text: "Go higher — stronger offer." },
};

export default function BargainModal({
  open,
  target,
  trigger,
  siteId = "prc",
  onClose,
}: {
  open: boolean;
  target: BargainTarget;
  trigger: string;
  siteId?: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [phase, setPhase] = useState<"loading" | "play" | "won" | "lost" | "blocked">("loading");
  const [listInr, setListInr] = useState(target.listInr);
  const [attemptsLeft, setAttemptsLeft] = useState<number>(BARGAIN.attempts);
  const [guess, setGuess] = useState("");
  const [heat, setHeat] = useState<"close" | "low" | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [blockedMsg, setBlockedMsg] = useState("");
  const [win, setWin] = useState<{
    price: number;
    discount: number;
    code?: string;
    expiresAtMs: number;
    uiEndsAtMs: number;
  } | null>(null);
  // Client-only modal (mounted via ssr:false), so Date.now() in the initializer
  // is safe and avoids a one-frame wrong-timer flash on the win screen.
  const [nowMs, setNowMs] = useState(() => Date.now());
  const startedRef = useRef(false);
  const guessedRef = useRef(false); // did they submit ≥1 guess?
  const wonRef = useRef(false);

  const call = useCallback(
    async (guessInr?: number): Promise<ServerResult> => {
      const r = await fetch("/api/bargain/offer", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ skuId: target.skuId, siteId, guessInr }),
      });
      return (await r.json()) as ServerResult;
    },
    [target.skuId, siteId],
  );

  function applyResult(d: ServerResult) {
    if (typeof d.listInr === "number") setListInr(d.listInr);
    if (typeof d.attemptsLeft === "number") setAttemptsLeft(d.attemptsLeft);
    switch (d.state) {
      case "won":
        wonRef.current = true;
        setWin({
          price: d.wonPriceInr ?? 0,
          discount: d.discountInr ?? 0,
          code: d.couponCode,
          expiresAtMs: d.expiresAtMs ?? Date.now(),
          uiEndsAtMs: d.uiEndsAtMs ?? d.expiresAtMs ?? Date.now(),
        });
        setPhase("won");
        break;
      case "lost":
        setPhase("lost");
        break;
      case "cooldown":
        setBlockedMsg("You've already played this one — come back a bit later for another shot.");
        setPhase("blocked");
        break;
      case "expired":
        setBlockedMsg("That deal's timer ran out. Check back soon for another chance.");
        setPhase("blocked");
        break;
      default:
        setPhase("play");
    }
  }

  // Close, firing a "saw it but never played" event when that's what happened.
  const handleClose = useCallback(() => {
    if (!guessedRef.current && !wonRef.current) {
      trackFunnel("bargain_seen_no_play", { skuId: target.skuId, trigger });
    }
    onClose();
  }, [onClose, target.skuId, trigger]);

  // Start (peek) the game once when opened.
  useEffect(() => {
    if (!open || startedRef.current) return;
    startedRef.current = true;
    trackFunnel("bargain_open", { trigger, skuId: target.skuId });
    (async () => {
      try {
        const d = await call();
        if (d.disabled || !d.ok) {
          onClose();
          return;
        }
        applyResult(d);
      } catch {
        onClose();
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Lock body scroll + Esc to close while open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && handleClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, handleClose]);

  // Tick a clock while a win is on screen — drives both the visible countdown
  // and whether the (longer) coupon is still redeemable.
  useEffect(() => {
    if (phase !== "won") return;
    const tick = () => setNowMs(Date.now());
    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [phase]);

  async function submitGuess(e: React.FormEvent) {
    e.preventDefault();
    const g = parseInt(guess.replace(/[^\d]/g, ""), 10);
    if (!Number.isFinite(g) || g <= 0) {
      setErr("Type a price");
      return;
    }
    if (g >= listInr) {
      setErr(`Offer below the ${inr(listInr)} sticker price`);
      return;
    }
    setErr("");
    setBusy(true);
    setHeat(null);
    guessedRef.current = true;
    try {
      const d = await call(g);
      if (!d.ok) {
        setErr(d.error ?? "Try again");
        setBusy(false);
        return;
      }
      trackFunnel("bargain_guess", {
        skuId: target.skuId,
        outcome: d.state === "active" ? d.heat : d.state,
      });
      if (d.state === "won") {
        trackFunnel("bargain_won", { skuId: target.skuId, discountInr: d.discountInr });
      } else if (d.state === "lost") {
        trackFunnel("bargain_lost", { skuId: target.skuId });
      } else if (d.state === "active" && d.heat) {
        setHeat(d.heat);
        setGuess("");
      }
      applyResult(d);
    } catch {
      setErr("Network hiccup — try again");
    } finally {
      setBusy(false);
    }
  }

  function buyNow() {
    if (!win) return;
    trackFunnel("bargain_checkout", { skuId: target.skuId }, { immediate: true });
    if (win.code) {
      try {
        navigator.clipboard?.writeText(win.code);
      } catch {
        /* clipboard optional */
      }
      router.push(`/checkout?bg=${encodeURIComponent(win.code)}`);
    } else {
      router.push("/checkout");
    }
    onClose();
  }

  if (!open) return null;

  // Win timers.
  const uiRemaining = win ? Math.max(0, win.uiEndsAtMs - nowMs) : 0;
  const canBuy = win ? nowMs < win.expiresAtMs : false;
  const seconds = Math.ceil(uiRemaining / 1000);
  const mm = Math.floor(seconds / 60);
  const ss = String(seconds % 60).padStart(2, "0");
  const trivial = win ? win.discount <= 0 : false;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Name your price"
      onClick={handleClose}
      className="fixed inset-0 z-[70] grid place-items-center bg-black/60 p-4 backdrop-blur-sm"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-sm overflow-hidden rounded-3xl bg-[#08090B] text-white shadow-[0_40px_100px_rgba(0,0,0,.7)] ring-1 ring-white/[0.12] backdrop-blur-2xl"
      >
        <button
          type="button"
          onClick={handleClose}
          aria-label="Close"
          className="absolute right-3 top-3 z-10 grid h-9 w-9 place-items-center rounded-full bg-white/10 text-white/70 hover:bg-white/20"
        >
          <X size={18} />
        </button>

        <div className="relative px-6 pb-7 pt-9 text-center">
          {/* ── PLAY ── */}
          {(phase === "loading" || phase === "play") && (
            <>
              {/* eyebrow — calm & exclusive, not a scammy shout */}
              <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.32em] text-white/45">
                Private price · just for you
              </p>
              <h3 className="mt-2.5 font-display text-[26px] font-extrabold uppercase leading-[1.05]">
                Name your price
              </h3>
              <p className="mx-auto mt-2 max-w-[16rem] text-[13px] leading-relaxed text-white/55">
                Beat the sticker in {BARGAIN.attempts} tries. Match our number and it&apos;s
                yours — at the price you type.
              </p>

              {/* product row — grounds it in the REAL item, kills the generic-popup feel */}
              <div className="mt-5 flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-2.5 pr-4 text-left">
                {target.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={target.image}
                    alt=""
                    className="h-12 w-12 shrink-0 rounded-xl bg-white/[0.04] object-cover"
                  />
                ) : (
                  <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-white/[0.06]">
                    <Tag size={18} className="text-white/40" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-white">{target.name}</p>
                  <p className="mt-0.5 text-[12px] text-white/45">
                    Sticker price ·{" "}
                    <span className="font-semibold tabular-nums text-white/70">{inr(listInr)}</span>
                  </p>
                </div>
              </div>

              {/* attempts */}
              <div className="mt-4 flex items-center justify-center gap-2">
                <div className="flex items-center gap-1.5">
                  {Array.from({ length: BARGAIN.attempts }).map((_, i) => (
                    <span
                      key={i}
                      className={`h-1.5 w-1.5 rounded-full ${i < attemptsLeft ? "bg-brand-red" : "bg-white/15"}`}
                    />
                  ))}
                </div>
                <span className="text-[11px] uppercase tracking-wide text-white/40">
                  {attemptsLeft} {attemptsLeft === 1 ? "try" : "tries"} left
                </span>
              </div>

              {heat && (
                <div className="prcbg-pop mt-3 flex items-center justify-center gap-2 rounded-xl bg-white/[0.05] px-4 py-2.5 text-[13px] text-white/90">
                  {(() => {
                    const Icon = HEAT[heat].Icon;
                    return <Icon size={15} className="shrink-0 text-brand-red" />;
                  })()}
                  <span>{HEAT[heat].text}</span>
                </div>
              )}

              <form onSubmit={submitGuess} className="mt-4">
                <div className="flex items-center overflow-hidden rounded-2xl border border-white/[0.12] bg-black/40 transition-colors focus-within:border-brand-red/70 focus-within:bg-black/60">
                  <span className="pl-5 pr-1 text-2xl font-semibold text-white/45">₹</span>
                  <input
                    value={guess}
                    onChange={(e) => setGuess(e.target.value.replace(/[^\d]/g, "").slice(0, 8))}
                    inputMode="numeric"
                    autoFocus
                    placeholder="0"
                    disabled={busy || phase === "loading"}
                    className="w-full bg-transparent py-4 pr-5 text-2xl font-semibold tabular-nums text-white placeholder:text-white/25 focus:outline-none"
                  />
                </div>
                {err && <p className="mt-2 text-xs text-red-300">{err}</p>}
                <button
                  type="submit"
                  disabled={busy || phase === "loading"}
                  className="mt-3 inline-flex h-[56px] w-full items-center justify-center gap-2 rounded-full bg-brand-red px-6 text-[15px] font-extrabold uppercase tracking-wide text-white shadow-[0_12px_30px_rgba(225,29,42,.35)] transition-transform hover:brightness-110 active:scale-[0.98] disabled:opacity-60"
                >
                  {busy ? (
                    "Checking…"
                  ) : phase === "loading" ? (
                    "…"
                  ) : (
                    <>
                      <Tag size={17} /> Make my offer
                    </>
                  )}
                </button>
              </form>
              <p className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-white/40">
                <Lock size={11} className="text-white/35" /> One shot per shopper · make your first
                offer count
              </p>
            </>
          )}

          {/* ── WON — a calm, premium private-price unlock ── */}
          {phase === "won" && win && (
            <div className="prcbg-pop relative">
              {/* subtle WHITE glow behind the price — luxury, not a red alert */}
              <div
                aria-hidden
                className="pointer-events-none absolute left-1/2 top-[36%] h-28 w-44 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/[0.06] blur-3xl"
              />

              <div className="relative z-10 flex flex-col items-center">
                {/* 1 — badge */}
                <div className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.12] bg-white/[0.03] px-3.5 py-1.5">
                  <PartyPopper size={13} className="text-white/70" />
                  <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-white/85">
                    {trivial ? "Best price" : "Private deal unlocked"}
                  </span>
                </div>

                {/* 2 — HERO price (the strongest element) */}
                <p className="mt-5 text-[11px] uppercase tracking-[0.3em] text-white/40">
                  {trivial ? "Your price" : "You negotiated"}
                </p>
                {!trivial && (
                  <p className="mt-2 text-sm text-white/35">
                    <s>{inr(listInr)}</s>
                  </p>
                )}
                <p className="mt-1 font-display text-[70px] font-extrabold leading-none tracking-tight text-white [text-shadow:0_0_40px_rgba(255,255,255,.22)]">
                  {inr(win.price)}
                </p>

                {/* 3 — saving (red only on the amount) */}
                {!trivial ? (
                  <p className="mt-4 flex items-center gap-1.5 text-base text-white/90">
                    <span>You saved</span>
                    <span className="font-bold text-white">{inr(win.discount)}</span>
                    <Sparkles size={15} className="text-white/45" />
                  </p>
                ) : (
                  <p className="mt-4 text-sm text-white/55">Our best price — locked in for you</p>
                )}

                {canBuy ? (
                  <>
                    {/* 4 — reserved-for pill (dark glass) */}
                    {uiRemaining > 0 && (
                      <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-1.5">
                        <Hourglass size={12} className="text-white/45" />
                        <span className="text-[11px] uppercase tracking-[0.14em] text-white/50">
                          Reserved for
                        </span>
                        <span className="font-mono text-sm font-bold tabular-nums text-white">
                          {mm}:{ss}
                        </span>
                      </div>
                    )}

                    {/* 5 — CTA */}
                    <button
                      type="button"
                      onClick={buyNow}
                      className="mt-5 inline-flex h-[58px] w-full items-center justify-center gap-2 rounded-full bg-brand-red px-6 text-[15px] font-extrabold uppercase tracking-wide text-white shadow-[0_12px_30px_rgba(225,29,42,.4)] transition-transform hover:brightness-110 active:scale-[0.97]"
                    >
                      <Zap size={19} /> Secure my {inr(win.price)} price
                    </button>

                    <p className="mt-4 flex items-center gap-1.5 text-xs text-white/60">
                      <Check size={14} className="text-emerald-400" /> Your discount is applied
                    </p>
                  </>
                ) : (
                  <p className="mt-5 text-sm text-white/60">
                    Your reserved price expired — but you can still buy at the sticker price.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* ── LOST ── */}
          {phase === "lost" && (
            <div className="prcbg-pop">
              <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-white/50">
                No deal this time
              </p>
              <h3 className="mt-2 font-display text-2xl font-extrabold">Ah, so close!</h3>
              <p className="mt-2 text-sm text-white/60">
                Those three didn&apos;t land — but {target.name} is still a steal at{" "}
                {inr(listInr)}.
              </p>
              <button
                type="button"
                onClick={handleClose}
                className="mt-5 min-h-[44px] w-full rounded-full bg-brand-red px-6 py-3.5 text-base font-bold uppercase tracking-wide text-white shadow-lg"
              >
                Keep shopping
              </button>
            </div>
          )}

          {/* ── BLOCKED (cooldown / expired) ── */}
          {phase === "blocked" && (
            <div className="prcbg-pop">
              <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-white/50">
                Hang tight
              </p>
              <p className="mt-3 text-sm text-white/70">{blockedMsg}</p>
              <button
                type="button"
                onClick={handleClose}
                className="mt-5 min-h-[44px] w-full rounded-full bg-white/10 px-6 py-3 text-sm font-semibold text-white hover:bg-white/20"
              >
                Keep shopping
              </button>
            </div>
          )}
        </div>
      </div>

      <style>{`
        .prcbg-pop{animation:prcbg-pop .32s ease-out both}
        @keyframes prcbg-pop{0%{opacity:0;transform:scale(.9)}100%{opacity:1;transform:scale(1)}}
        @media (prefers-reduced-motion: reduce){.prcbg-pop{animation:none}}
      `}</style>
    </div>
  );
}
