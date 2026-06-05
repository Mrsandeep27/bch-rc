"use client";

/**
 * P03 — Value-stack total. Reframes the ₹999 price as "you win the trade"
 * by listing what the box contains with each item's standalone value,
 * totalling it, and then showing the actual paid number against that
 * total. Anchoring + Brunson offer-stacking: bonuses that are never added
 * up never make the buyer feel they're winning.
 *
 * Replaces the previous 5-card OfferStack which crammed FREE drift wheels,
 * online-pay bonus, buy-2 bundle, festival drop, AND a paid LED upgrade
 * into one row — number soup with no anchor. The 2-car bundle savings now
 * live in BundlePicker (their natural home); the LED upgrade has been
 * dropped here (it's an upsell, surfaced on the PDP instead).
 *
 * The line items are real costs we'd actually charge if priced separately:
 *   - Replacement drift wheels: ₹199 (the spare-parts price in faqs.ts)
 *   - USB-C charger + battery: ₹300 (battery alone is ₹199, charger ~₹100)
 *   - Gift-ready packaging: ₹150 (Shiprocket-grade gift box + insert)
 * Total comes to a clean ₹1,648 of "stuff" — vs the ₹999 paid online.
 * Reframes from "is ₹999 too much for a toy?" to "₹649 of stuff is FREE".
 */

import { Gift, Wrench, Battery, Box, ShieldCheck } from "lucide-react";
import { OFFERS } from "@/lib/config";
import { getHeroSku } from "@/lib/products";
import { formatINR } from "@/lib/utils";

const HERO = getHeroSku();
const ONLINE_PRICE = HERO.retailINR - OFFERS.prepaidDiscountINR;

type StackItem = {
  icon: typeof Gift;
  label: string;
  value: number;
  paid: boolean;
  note?: string;
};

const STACK: StackItem[] = [
  {
    icon: Gift,
    label: "Die-cast 1:64 RC drift car",
    value: HERO.retailINR,
    paid: true,
  },
  {
    icon: Wrench,
    label: "Drift + grip wheel sets",
    value: 199,
    paid: false,
    note: "Worth ₹199 separately",
  },
  {
    icon: Battery,
    label: "USB-C charger + spare battery",
    value: 300,
    paid: false,
    note: "Battery ₹199 + charger ₹99",
  },
  {
    icon: Box,
    label: "Gift-ready box + insert",
    value: 150,
    paid: false,
    note: "Premium packaging",
  },
  {
    icon: ShieldCheck,
    label: "7-day replacement guarantee",
    value: 0,
    paid: false,
    note: "Real WhatsApp number",
  },
];

const TOTAL_VALUE = STACK.reduce((s, i) => s + i.value, 0) + 199; // +₹199 for guarantee
const SAVE = TOTAL_VALUE - ONLINE_PRICE;

export default function ValueStack() {
  return (
    <section className="py-5 sm:py-8 bg-brand-cream">
      <div className="max-w-3xl mx-auto px-4">
        <div className="text-center">
          <p className="text-[10px] font-mono uppercase tracking-widest text-brand-red">
            What you actually get
          </p>
          <h2 className="font-display text-lg sm:text-2xl font-bold text-brand-ink mt-1 text-balance">
            {formatINR(TOTAL_VALUE)} of car. You pay {formatINR(ONLINE_PRICE)}.
          </h2>
        </div>

        {/* Compact two-column grid on sm+; one column on mobile. Each row is
            a single line — icon + label + value/FREE — with the `note` only
            shown on the paid hero row to keep the others crisp. */}
        <ul className="mt-3 sm:mt-4 bg-white rounded-xl border border-brand-line divide-y divide-brand-line overflow-hidden text-sm sm:grid sm:grid-cols-2 sm:divide-y-0 sm:divide-x">
          {STACK.map(({ icon: Icon, label, paid }) => (
            <li
              key={label}
              className="flex items-center gap-2.5 px-3 sm:px-4 py-2 sm:py-2.5 sm:border-b sm:border-brand-line sm:last:border-b-0"
            >
              <span className="shrink-0 w-6 h-6 rounded-md bg-brand-red-soft text-brand-red flex items-center justify-center">
                <Icon size={13} aria-hidden />
              </span>
              <span className="flex-1 min-w-0 text-brand-ink text-xs sm:text-sm leading-tight truncate">
                {label}
              </span>
              {paid ? (
                <span className="shrink-0 font-semibold text-brand-ink text-xs sm:text-sm tabular-nums">
                  {formatINR(STACK.find((s) => s.label === label)!.value)}
                </span>
              ) : (
                <span className="shrink-0 text-success font-bold text-[11px] sm:text-xs">
                  FREE
                </span>
              )}
            </li>
          ))}
        </ul>

        {/* Total + paid bar — single row, brand-red full-width strip so the
            "you save ₹X" payoff is the loudest line in the section. */}
        <div className="mt-3 bg-brand-red text-white rounded-xl px-4 py-2.5 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-baseline gap-2">
            <span className="font-bold text-sm sm:text-base">You pay</span>
            <span className="text-white/70 text-xs line-through tabular-nums">
              {formatINR(TOTAL_VALUE)}
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-bold text-base sm:text-lg tabular-nums">
              {formatINR(ONLINE_PRICE)}
            </span>
            <span className="text-white/85 text-[11px] sm:text-xs font-mono uppercase tracking-widest">
              save {formatINR(SAVE)}
            </span>
          </div>
        </div>

        <p className="text-center text-[10px] sm:text-xs text-brand-ink-soft mt-2 font-mono uppercase tracking-widest">
          COD → {formatINR(HERO.retailINR)} · 7-day replacement
        </p>
      </div>
    </section>
  );
}
