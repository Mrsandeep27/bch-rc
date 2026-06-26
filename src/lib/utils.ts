import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatINR(amount: number): string {
  return `₹${amount.toLocaleString("en-IN")}`;
}

export function calcDiscountPct(mrp: number, retail: number): number {
  return Math.round(((mrp - retail) / mrp) * 100);
}

/**
 * Format a timestamp for display in IST, ALWAYS.
 *
 * Order/event times are stored as timestamptz (a correct UTC instant). When you
 * format with toLocaleString WITHOUT an explicit timeZone, JS uses the runtime's
 * timezone — which is UTC on Vercel (server components render on the server). The
 * result was every admin/invoice time showing 5h30m behind the real IST time,
 * while Razorpay (IST) and the one already-fixed pack screen showed the truth.
 *
 * Pin Asia/Kolkata here so the host timezone can never leak into a displayed
 * time again. `value` accepts a Date, ISO string or epoch ms. Default style is
 * "26 Jun 2026, 6:15 pm"; pass opts for date-only / time-only renders.
 */
export function formatIST(
  value: Date | string | number,
  opts: Intl.DateTimeFormatOptions = { dateStyle: "medium", timeStyle: "short" },
): string {
  return new Date(value).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    ...opts,
  });
}
