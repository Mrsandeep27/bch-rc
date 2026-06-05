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
    <section className="py-8 sm:py-14 bg-brand-cream">
      <div className="max-w-3xl mx-auto px-4">
        <div className="text-center">
          <p className="text-[10px] sm:text-xs font-mono uppercase tracking-widest text-brand-red">
            What you actually get
          </p>
          <h2 className="font-display text-2xl sm:text-4xl font-bold text-brand-ink mt-1.5 sm:mt-2 text-balance">
            ₹{formatINR(TOTAL_VALUE).replace("₹", "")} of car. You pay ₹{ONLINE_PRICE}.
          </h2>
        </div>

        <ul className="mt-6 sm:mt-8 bg-white rounded-2xl border border-brand-line divide-y divide-brand-line overflow-hidden">
          {STACK.map(({ icon: Icon, label, value, paid, note }) => (
            <li
              key={label}
              className="flex items-center gap-3 sm:gap-4 px-4 sm:px-5 py-3 sm:py-4"
            >
              <span className="shrink-0 w-9 h-9 rounded-lg bg-brand-red-soft text-brand-red flex items-center justify-center">
                <Icon size={18} aria-hidden />
              </span>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-brand-ink text-sm sm:text-base leading-tight">
                  {label}
                </div>
                {note && (
                  <div className="text-[11px] sm:text-xs text-brand-ink-soft mt-0.5">
                    {note}
                  </div>
                )}
              </div>
              <div className="shrink-0 text-right">
                {paid ? (
                  <span className="font-semibold text-brand-ink text-sm sm:text-base">
                    {formatINR(value)}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-success font-bold text-sm sm:text-base">
                    FREE
                  </span>
                )}
              </div>
            </li>
          ))}
          <li className="flex items-center justify-between px-4 sm:px-5 py-4 bg-brand-cream/70 font-bold">
            <span className="text-brand-ink text-sm sm:text-base">
              Total value if priced separately
            </span>
            <span className="text-brand-ink-soft line-through text-sm sm:text-base tabular-nums">
              {formatINR(TOTAL_VALUE)}
            </span>
          </li>
          <li className="flex items-center justify-between px-4 sm:px-5 py-4 bg-brand-red text-white font-bold">
            <span className="text-sm sm:text-base">You pay online</span>
            <span className="text-base sm:text-lg tabular-nums">
              {formatINR(ONLINE_PRICE)}{" "}
              <span className="text-white/80 font-normal text-xs">
                (save {formatINR(SAVE)})
              </span>
            </span>
          </li>
        </ul>

        <p className="text-center text-[11px] sm:text-xs text-brand-ink-soft mt-4 font-mono uppercase tracking-widest">
          Pay on delivery → {formatINR(HERO.retailINR)} · 7-day replacement
        </p>
      </div>
    </section>
  );
}
