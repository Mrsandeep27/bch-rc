"use client";

/**
 * Decides WHEN to offer the bargain game and to WHICH product, then renders the
 * modal. Only fires for a shopper who is slipping away with something in their
 * cart — the "not buying" moment — and at most once per session so it never nags.
 *
 * A/B: even with the flag on, only `BARGAIN.abTestPct`% of shoppers see the game
 * (bucket persisted per browser, announced once per session as `bargain_ab`).
 * The rest are the control group — so we can compare profit/order, not just
 * conversion, before going wide.
 *
 * Phone-friendly triggers (desktop has no "mouse to close tab"):
 *   - BACK button  → a one-time history trap catches the press instead of leaving
 *   - IDLE         → TRUE idle (timer resets on any interaction) and never fires
 *                    while an input is focused, so a buyer typing their address /
 *                    coupon is never interrupted
 *   - RETURN       → left to another app / lock screen, then came back to the tab
 *
 * Target = the most valuable line in the 1:64 cart (the sale worth rescuing).
 * Inert unless NEXT_PUBLIC_BARGAIN_ENABLED is on.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import dynamic from "next/dynamic";
import { useCart, getCartLines } from "@/lib/cart-store";
import { isBargainEnabled, BARGAIN } from "@/lib/config";
import { trackFunnel } from "@/lib/funnel-client";
import type { BargainTarget } from "@/components/BargainModal";

const BargainModal = dynamic(() => import("@/components/BargainModal"), { ssr: false });

const SESSION_FLAG = "prc_bargain_shown";
const AB_KEY = "prc_bargain_ab"; // localStorage: "on" | "off", persisted per browser
const AB_ANNOUNCED = "prc_bargain_ab_sent"; // sessionStorage: fired the event once
const IDLE_MS_CHECKOUT = 18_000;
const IDLE_MS_DEFAULT = 40_000;

function isShoppingPath(path: string): boolean {
  return !/^\/(admin|pack|cod|orders|maintenance)(\/|$)/.test(path);
}

export default function BargainLauncher() {
  const enabled = isBargainEnabled();
  const pathname = usePathname() ?? "/";
  const items = useCart((s) => s.items);
  const hasHydrated = useCart((s) => s.hasHydrated);
  const [open, setOpen] = useState(false);
  const [trigger, setTrigger] = useState("manual");
  const [fired, setFired] = useState(false);
  const firedRef = useRef(false);
  // Push the back-button trap only ONCE per session — the effect re-runs on every
  // navigation, and pushing a history entry each time would pollute history so
  // the back button needs multiple presses to actually leave.
  const backTrapRef = useRef(false);

  const target = useMemo<BargainTarget | null>(() => {
    if (!hasHydrated || items.length === 0) return null;
    const lines = getCartLines(items);
    if (lines.length === 0) return null;
    const top = lines.reduce((a, b) => (b.unitPriceINR > a.unitPriceINR ? b : a));
    return {
      skuId: top.sku.id,
      name: top.sku.cardTitle ?? top.sku.name,
      image: top.variantImage ?? top.sku.heroImage,
      listInr: top.unitPriceINR,
    };
  }, [items, hasHydrated]);

  const armed = enabled && !!target && !open && !fired && isShoppingPath(pathname);

  useEffect(() => {
    if (!armed) return;
    if (typeof window === "undefined") return;
    // Came here FROM the game (already won) → don't re-offer.
    if (/[?&]bg=/.test(window.location.search)) return;
    try {
      if (sessionStorage.getItem(SESSION_FLAG)) return;
    } catch {
      /* storage blocked — still allow */
    }

    // A/B bucket — persist per browser, announce once per session.
    let bucket = "on";
    try {
      const stored = localStorage.getItem(AB_KEY);
      if (stored === "on" || stored === "off") {
        bucket = stored;
      } else {
        bucket = Math.random() * 100 < BARGAIN.abTestPct ? "on" : "off";
        localStorage.setItem(AB_KEY, bucket);
      }
    } catch {
      bucket = "on";
    }
    try {
      if (!sessionStorage.getItem(AB_ANNOUNCED)) {
        sessionStorage.setItem(AB_ANNOUNCED, "1");
        trackFunnel("bargain_ab", { bucket });
      }
    } catch {
      /* ignore */
    }
    if (bucket === "off") return; // control group — never sees the game

    const isTyping = () => {
      const el = document.activeElement as HTMLElement | null;
      if (!el) return false;
      const tag = el.tagName;
      return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
    };

    const fire = (why: string, respectTyping: boolean) => {
      if (firedRef.current) return;
      // Never interrupt a buyer who is actively filling the form / converting.
      if (respectTyping && isTyping()) return;
      firedRef.current = true;
      try {
        sessionStorage.setItem(SESSION_FLAG, "1");
      } catch {
        /* ignore */
      }
      setFired(true);
      setTrigger(why);
      setOpen(true);
    };

    // BACK-button trap: push one throwaway entry ONCE per session (guarded so
    // repeated navigations don't stack phantom entries); the buyer's next Back
    // press pops it → we intercept once. Explicit exit, so it fires even mid-typing.
    if (!backTrapRef.current) {
      try {
        window.history.pushState({ prcBargain: 1 }, "");
        backTrapRef.current = true;
      } catch {
        /* history unavailable */
      }
    }
    const onPop = () => fire("back", false);
    window.addEventListener("popstate", onPop);

    // TRUE idle: reset the timer on any real interaction, and never fire while an
    // input is focused. Shorter on checkout (peak hesitation, nothing to read).
    const idleMs = /^\/checkout(\/|$)/.test(pathname) ? IDLE_MS_CHECKOUT : IDLE_MS_DEFAULT;
    let idleId = window.setTimeout(() => fire("idle", true), idleMs);
    const resetIdle = () => {
      window.clearTimeout(idleId);
      idleId = window.setTimeout(() => fire("idle", true), idleMs);
    };
    const activity = ["pointerdown", "keydown", "scroll", "touchstart"] as const;
    activity.forEach((ev) => window.addEventListener(ev, resetIdle, { passive: true }));

    // RETURN: they left to another app / locked the phone, then came back.
    let wasHidden = false;
    const onVis = () => {
      if (document.visibilityState === "hidden") wasHidden = true;
      else if (wasHidden) fire("return", false);
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      window.removeEventListener("popstate", onPop);
      window.clearTimeout(idleId);
      activity.forEach((ev) => window.removeEventListener(ev, resetIdle));
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [armed, pathname]);

  if (!enabled || !target) return null;

  return (
    <BargainModal
      open={open}
      target={target}
      trigger={trigger}
      onClose={() => setOpen(false)}
    />
  );
}
