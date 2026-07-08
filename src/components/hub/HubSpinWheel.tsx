"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { X } from "lucide-react";
import { waLink } from "@/lib/theme";
import { WhatsAppIcon } from "@/components/BrandIcons";
import { trackFunnel } from "@/lib/funnel-client";

/**
 * Hub — "Drift for your discount" lead capture (spin-wheel reimagined as a
 * tyre burnout). Pops 3 s after entry (once per visitor). Flow:
 *   idle → HIT THE THROTTLE → tyre spins + smoke (drifting) → offer reveal →
 *   phone capture → code + WhatsApp claim.
 *
 * OFFER is a PLACEHOLDER — owner sets the real offer, gate and a REAL working
 * coupon code (create it in the coupon system so it validates at checkout).
 */
const OFFER = {
  headline: "25% OFF", // placeholder
  detail: "on your order", // placeholder — set the gate, e.g. "on any 2 cars"
  code: "DRIFT25", // placeholder — must match a real coupon
  expiryHrs: 48,
};

const BUTTON_LABEL = "HIT THE THROTTLE";
// PRC RACING tyre (gold rim). The render circular-crops + scales it to hide the
// image's gray studio backdrop. Set to null to fall back to the CSS tyre.
const TYRE_SRC: string | null = "/landing/tyre.webp";
const OPEN_DELAY_MS = 3000; // pop 3s after entry
const SEEN_KEY = "prc_wheel_v1_seen"; // don't auto-pop again this browser
const DONE_KEY = "prc_wheel_v1_done"; // one drift per visitor

type Phase = "idle" | "drifting" | "reveal" | "claimed";

export default function HubSpinWheel() {
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);
  const [tyreOk, setTyreOk] = useState(true); // false → use CSS tyre fallback
  const timers = useRef<number[]>([]);

  // Auto-open 3s after entry — once per visitor, and never if they already span.
  useEffect(() => {
    let alreadyDone = false;
    try {
      alreadyDone = localStorage.getItem(DONE_KEY) === "1";
      setDone(alreadyDone);
      if (alreadyDone || localStorage.getItem(SEEN_KEY) === "1") return;
    } catch {
      /* storage blocked — still show it */
    }
    const t = window.setTimeout(() => {
      setOpen(true);
      try {
        localStorage.setItem(SEEN_KEY, "1");
      } catch {}
      trackFunnel("wheel_open", { via: "auto" });
    }, OPEN_DELAY_MS);
    timers.current.push(t);
    return () => timers.current.forEach((id) => clearTimeout(id));
  }, []);

  // Esc to close + lock body scroll while open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  const openManual = () => {
    setOpen(true);
    setPhase(done ? "claimed" : "idle"); // returning visitor sees their code
    trackFunnel("wheel_open", { via: "tab" });
  };

  const drift = () => {
    if (phase !== "idle") return;
    setPhase("drifting");
    trackFunnel("wheel_spin", {});
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const t = window.setTimeout(() => setPhase("reveal"), reduce ? 400 : 2200);
    timers.current.push(t);
  };

  const claim = (e: FormEvent) => {
    e.preventDefault();
    const nm = name.trim();
    const p = phone.replace(/\D/g, "").slice(-10);
    if (nm.length < 2) {
      setErr("Enter your name");
      return;
    }
    if (p.length !== 10) {
      setErr("Enter a valid 10-digit number");
      return;
    }
    setErr("");
    try {
      localStorage.setItem(DONE_KEY, "1");
    } catch {}
    setDone(true);
    trackFunnel("wheel_lead", { code: OFFER.code }); // event only — no PII here
    // Persist name + phone as a real lead so the team can call / WhatsApp them.
    // Best-effort: the endpoint is rate-limited, never blocks, returns 200 on
    // failure. Lands the contact in the recovery / telecaller queue.
    try {
      void fetch("/api/checkout/lead", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ siteId: "prc", address: { fullName: nm, phone: p }, items: [] }),
        keepalive: true,
      }).catch(() => {});
    } catch {}
    setPhase("claimed");
  };

  return (
    <>
      {/* re-open tab — bottom-left, opposite the WhatsApp FAB */}
      {!open && (
        <button
          type="button"
          onClick={openManual}
          className="fixed bottom-4 left-4 z-40 inline-flex items-center gap-1.5 rounded-full bg-brand-red px-4 py-2.5 text-sm font-bold text-white shadow-lg ring-2 ring-white/20 transition-transform hover:scale-105"
        >
          <span aria-hidden>🏁</span> {done ? "Your code" : `${OFFER.headline}`}
        </button>
      )}

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Drift for your discount"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-[60] grid place-items-center bg-black/60 p-4 backdrop-blur-sm"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-sm overflow-hidden rounded-3xl bg-white/10 text-white shadow-2xl ring-1 ring-white/20 backdrop-blur-2xl"
          >
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="absolute right-3 top-3 z-10 grid h-8 w-8 place-items-center rounded-full bg-white/10 text-white/70 hover:bg-white/20"
            >
              <X size={18} />
            </button>

            {/* soft red glow */}
            <div aria-hidden className="pointer-events-none absolute -top-20 left-1/2 h-52 w-52 -translate-x-1/2 rounded-full bg-brand-red/25 blur-3xl" />

            {/* ── idle / drifting: the tyre stage ── */}
            {(phase === "idle" || phase === "drifting") && (
              <div className="relative px-6 pb-7 pt-10 text-center">
                <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-brand-red">Drift for your discount</p>
                <h3 className="mt-2 font-display text-2xl font-extrabold uppercase tracking-wide">
                  Send it — win {OFFER.headline}
                </h3>

                <div className="relative mx-auto mt-6 grid h-48 w-48 place-items-center">
                  <div className={phase === "drifting" ? "prcwheel-shake" : ""}>
                    {TYRE_SRC && tyreOk ? (
                      <div
                        className={`h-44 w-44 overflow-hidden rounded-full drop-shadow-2xl ${phase === "drifting" ? "prcwheel-go" : ""}`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={TYRE_SRC}
                          alt=""
                          aria-hidden
                          onError={() => setTyreOk(false)}
                          className="h-full w-full scale-[1.24] object-cover"
                        />
                      </div>
                    ) : (
                      <div className={`prcwheel-tyre ${phase === "drifting" ? "prcwheel-go" : ""}`}>
                        <div className="prcwheel-rim" />
                        <div className="prcwheel-hub" />
                      </div>
                    )}
                  </div>

                  {/* burnout smoke — ON TOP of the tyre, billows up + to the left */}
                  {phase === "drifting" && (
                    <div className="pointer-events-none absolute inset-0 z-10 overflow-visible">
                      {[0, 1, 2, 3, 4, 5, 6].map((i) => (
                        <span
                          key={i}
                          className="prcwheel-smoke"
                          style={{ left: `${26 + i * 8}%`, animationDelay: `${i * 0.12}s` }}
                        />
                      ))}
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={drift}
                  disabled={phase === "drifting"}
                  className="mt-6 w-full rounded-full bg-brand-red px-6 py-3.5 text-base font-bold uppercase tracking-wide text-white shadow-lg transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-70"
                >
                  {phase === "drifting" ? "Drifting…" : BUTTON_LABEL}
                </button>
                <p className="mt-2 text-[11px] text-white/40">One drift · real code</p>
              </div>
            )}

            {/* ── reveal: capture ── */}
            {phase === "reveal" && (
              <div className="prcwheel-pop relative px-6 pb-7 pt-10 text-center">
                <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-brand-red">🏁 Unlocked</p>
                <h3 className="mt-1 font-display text-5xl font-extrabold">{OFFER.headline}</h3>
                <p className="mt-1 text-sm text-white/70">{OFFER.detail}</p>
                <form onSubmit={claim} className="mt-6 space-y-2">
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoComplete="name"
                    placeholder="Your name"
                    className="w-full rounded-full border border-white/15 bg-white/10 px-5 py-3 text-center text-white placeholder:text-white/40 focus:border-brand-red focus:outline-none"
                  />
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    inputMode="numeric"
                    autoComplete="tel"
                    placeholder="Your WhatsApp number"
                    className="w-full rounded-full border border-white/15 bg-white/10 px-5 py-3 text-center text-white placeholder:text-white/40 focus:border-brand-red focus:outline-none"
                  />
                  {err && <p className="text-xs text-red-300">{err}</p>}
                  <button
                    type="submit"
                    className="w-full rounded-full bg-brand-red px-6 py-3.5 text-base font-bold uppercase tracking-wide text-white shadow-lg transition-transform hover:scale-[1.02] active:scale-[0.98]"
                  >
                    Claim my code
                  </button>
                </form>
                <p className="mt-2 text-[11px] text-white/40">Code valid {OFFER.expiryHrs} hrs · one per customer</p>
              </div>
            )}

            {/* ── claimed: code + WhatsApp ── */}
            {phase === "claimed" && (
              <div className="prcwheel-pop relative px-6 pb-7 pt-10 text-center">
                <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-brand-red">Your code</p>
                <div className="mt-3 rounded-2xl border border-dashed border-white/30 bg-white/5 py-4">
                  <span className="font-display text-3xl font-extrabold tracking-[0.2em]">{OFFER.code}</span>
                </div>
                <p className="mt-2 text-sm text-white/70">
                  {OFFER.headline} {OFFER.detail} · valid {OFFER.expiryHrs} hrs
                </p>
                <a
                  href={waLink(`Hi, I'm ${name.trim() || "there"} — I unlocked ${OFFER.headline} ${OFFER.detail}. Code ${OFFER.code}. Please confirm!`)}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => trackFunnel("wheel_wa_claim", { code: OFFER.code })}
                  className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-whatsapp-green px-6 py-3.5 text-base font-semibold text-white shadow-lg transition-transform hover:scale-[1.02] active:scale-[0.98]"
                >
                  <WhatsAppIcon size={18} /> Send code to my WhatsApp
                </a>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="mt-3 text-sm text-white/60 underline underline-offset-2 hover:text-white"
                >
                  Keep browsing →
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Scoped animation + tyre styling. Unique prcwheel- names avoid clashes. */}
      <style>{`
        .prcwheel-tyre{position:relative;width:11rem;height:11rem;border-radius:9999px;
          background:repeating-conic-gradient(#141414 0 7deg,#2b2b2b 7deg 14deg);
          box-shadow:inset 0 0 0 7px #0a0a0a, inset 0 0 22px #000, 0 12px 32px rgba(0,0,0,.55);}
        .prcwheel-rim{position:absolute;inset:16%;border-radius:9999px;
          background:
            conic-gradient(#3a2c12 0 11deg,#d9b775 11deg 19deg,#3a2c12 19deg 30deg,#d9b775 30deg 38deg,#3a2c12 38deg 49deg,#d9b775 49deg 57deg,#3a2c12 57deg 68deg,#d9b775 68deg 76deg,#3a2c12 76deg 87deg,#d9b775 87deg 95deg,#3a2c12 95deg 106deg,#d9b775 106deg 114deg),
            radial-gradient(circle,#e5c489 0 38%,#a97c3e 56%,#5f4620 78%);
          background-blend-mode:overlay;
          box-shadow:inset 0 0 0 4px #241a0b, inset 0 0 12px rgba(0,0,0,.6);}
        .prcwheel-hub{position:absolute;inset:43%;border-radius:9999px;
          background:radial-gradient(circle,#555,#111);box-shadow:0 0 0 3px #000;}
        .prcwheel-go{animation:prcwheel-spin .16s linear infinite;}
        .prcwheel-shake{animation:prcwheel-shake .12s linear infinite;}
        .prcwheel-smoke{position:absolute;bottom:6%;width:72px;height:72px;border-radius:9999px;
          background:radial-gradient(circle,rgba(235,235,235,.9),rgba(200,200,200,0) 70%);
          filter:blur(7px);opacity:0;animation:prcwheel-smoke 1.3s ease-out infinite;}
        .prcwheel-pop{animation:prcwheel-pop .35s ease-out both;}
        @keyframes prcwheel-spin{to{transform:rotate(360deg)}}
        @keyframes prcwheel-shake{0%,100%{transform:translate(0,0)}25%{transform:translate(-2px,1px)}50%{transform:translate(2px,-1px)}75%{transform:translate(-1px,-2px)}}
        @keyframes prcwheel-smoke{0%{opacity:0;transform:translate(0,12px) scale(.4)}25%{opacity:.65}100%{opacity:0;transform:translate(-95px,-48px) scale(1.85)}}
        @keyframes prcwheel-pop{0%{opacity:0;transform:scale(.85)}100%{opacity:1;transform:scale(1)}}
        @media (prefers-reduced-motion: reduce){
          .prcwheel-go{animation-duration:.6s}
          .prcwheel-shake{animation:none}
        }
      `}</style>
    </>
  );
}
