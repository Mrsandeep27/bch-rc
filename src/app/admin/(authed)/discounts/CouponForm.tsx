"use client";

/**
 * Create / edit form for a coupon. One component drives both flows — `mode`
 * picks the server action. The server (actions.ts) is the authoritative
 * validator; the light client-side checks here only sharpen the UX. Raw string
 * values are sent as-is so the server owns every parse + conversion (notably
 * PERCENT → percent×100).
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Check, Loader2 } from "lucide-react";
import {
  createCoupon,
  updateCoupon,
  type CouponFormInput,
} from "./actions";

export type CouponFormValues = {
  code: string;
  type: "FLAT_INR" | "PERCENT" | "FREE_SHIPPING";
  value: string;
  minOrderInr: string;
  maxDiscountInr: string;
  usageLimit: string;
  perCustomerLimit: string;
  validFrom: string; // YYYY-MM-DD
  validTo: string; // YYYY-MM-DD or ""
  active: boolean;
};

export const EMPTY_COUPON: CouponFormValues = {
  code: "",
  type: "FLAT_INR",
  value: "",
  minOrderInr: "",
  maxDiscountInr: "",
  usageLimit: "",
  perCustomerLimit: "",
  validFrom: "",
  validTo: "",
  active: true,
};

const TYPE_OPTIONS: { value: CouponFormValues["type"]; label: string }[] = [
  { value: "FLAT_INR", label: "Flat ₹ off" },
  { value: "PERCENT", label: "Percent off" },
  { value: "FREE_SHIPPING", label: "Free shipping" },
];

const inputBase =
  "w-full rounded-lg border border-brand-line bg-white px-3 py-2 text-sm text-brand-ink focus:outline-none focus:border-brand-red";

export default function CouponForm({
  mode,
  couponId,
  initial,
}: {
  mode: "create" | "edit";
  couponId?: string;
  initial: CouponFormValues;
}) {
  const router = useRouter();
  const [v, setV] = useState<CouponFormValues>(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function set<K extends keyof CouponFormValues>(
    key: K,
    value: CouponFormValues[K],
  ) {
    setV((prev) => ({ ...prev, [key]: value }));
    setError(null);
  }

  const isPercent = v.type === "PERCENT";
  const isFlat = v.type === "FLAT_INR";
  const isFreeShip = v.type === "FREE_SHIPPING";

  // Light client guard — the server re-checks everything.
  function clientError(): string | null {
    if (!v.code.trim()) return "Enter a coupon code.";
    if (isFlat && !/^\d+$/.test(v.value.trim())) {
      return "Enter a discount amount in ₹.";
    }
    if (isPercent) {
      const n = Number(v.value.trim());
      if (!Number.isInteger(n) || n < 1 || n > 100) {
        return "Percentage must be between 1 and 100.";
      }
    }
    if (v.validFrom && v.validTo && v.validTo <= v.validFrom) {
      return "End date must be after the start date.";
    }
    return null;
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const local = clientError();
    if (local) {
      setError(local);
      return;
    }
    const payload: CouponFormInput = {
      code: v.code,
      type: v.type,
      value: v.value,
      minOrderInr: v.minOrderInr,
      maxDiscountInr: v.maxDiscountInr,
      usageLimit: v.usageLimit,
      perCustomerLimit: v.perCustomerLimit,
      validFrom: v.validFrom,
      validTo: v.validTo,
      active: v.active,
    };
    startTransition(async () => {
      const res =
        mode === "create"
          ? await createCoupon(payload)
          : await updateCoupon(couponId as string, payload);
      if (!res.ok) {
        setError(res.error ?? "Something went wrong.");
        return;
      }
      router.push("/admin/discounts");
      router.refresh();
    });
  }

  return (
    <div className="space-y-4 sm:space-y-5 max-w-2xl">
      <div>
        <Link
          href="/admin/discounts"
          className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-brand-ink-soft hover:text-brand-ink"
        >
          <ArrowLeft size={14} /> All discounts
        </Link>
        <h1 className="font-display text-lg sm:text-3xl font-bold text-brand-ink mt-2">
          {mode === "create" ? "Create discount" : "Edit discount"}
        </h1>
        <p className="text-sm text-brand-ink-soft mt-1">
          {mode === "create"
            ? "Coupon codes apply at checkout for this store."
            : "Changes take effect immediately at checkout."}
        </p>
      </div>

      <form onSubmit={submit} className="space-y-3 sm:space-y-4">
        {/* Code + type */}
        <div className="bg-white rounded-2xl border border-brand-line p-3 sm:p-5 space-y-3 sm:space-y-4">
          <Field label="Coupon code" hint="Uppercase. Letters, numbers, - and _.">
            <input
              type="text"
              value={v.code}
              onChange={(e) =>
                set("code", e.target.value.toUpperCase().replace(/\s/g, ""))
              }
              placeholder="SAVE10"
              className={`${inputBase} font-mono font-semibold tracking-wide`}
              autoFocus={mode === "create"}
              maxLength={40}
            />
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <Field label="Type">
              <select
                value={v.type}
                onChange={(e) =>
                  set("type", e.target.value as CouponFormValues["type"])
                }
                className={inputBase}
              >
                {TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </Field>

            {!isFreeShip && (
              <Field
                label={isPercent ? "Percentage" : "Amount"}
                hint={
                  isPercent
                    ? "1–100 (% off the subtotal)"
                    : "Flat ₹ off the subtotal"
                }
              >
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-brand-ink-soft pointer-events-none">
                    {isPercent ? "%" : "₹"}
                  </span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={v.value}
                    onChange={(e) =>
                      set("value", e.target.value.replace(/[^\d]/g, ""))
                    }
                    placeholder={isPercent ? "10" : "200"}
                    className={`${inputBase} pl-7 tabular-nums`}
                  />
                </div>
              </Field>
            )}
          </div>

          {isFreeShip && (
            <p className="text-xs text-brand-ink-soft bg-brand-cream rounded-lg px-3 py-2">
              Free-shipping coupons waive the shipping fee — no amount needed.
            </p>
          )}
        </div>

        {/* Conditions */}
        <div className="bg-white rounded-2xl border border-brand-line p-3 sm:p-5 space-y-3 sm:space-y-4">
          <h2 className="font-semibold text-brand-ink text-sm">Conditions</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <Field label="Minimum order (₹)" hint="Blank or 0 = no minimum">
              <input
                type="text"
                inputMode="numeric"
                value={v.minOrderInr}
                onChange={(e) =>
                  set("minOrderInr", e.target.value.replace(/[^\d]/g, ""))
                }
                placeholder="0"
                className={`${inputBase} tabular-nums`}
              />
            </Field>

            {isPercent && (
              <Field label="Max discount cap (₹)" hint="Blank = no cap">
                <input
                  type="text"
                  inputMode="numeric"
                  value={v.maxDiscountInr}
                  onChange={(e) =>
                    set("maxDiscountInr", e.target.value.replace(/[^\d]/g, ""))
                  }
                  placeholder="No cap"
                  className={`${inputBase} tabular-nums`}
                />
              </Field>
            )}

            <Field label="Total usage limit" hint="Blank = unlimited">
              <input
                type="text"
                inputMode="numeric"
                value={v.usageLimit}
                onChange={(e) =>
                  set("usageLimit", e.target.value.replace(/[^\d]/g, ""))
                }
                placeholder="Unlimited"
                className={`${inputBase} tabular-nums`}
              />
            </Field>

            <Field label="Per-customer limit" hint="Blank = unlimited">
              <input
                type="text"
                inputMode="numeric"
                value={v.perCustomerLimit}
                onChange={(e) =>
                  set("perCustomerLimit", e.target.value.replace(/[^\d]/g, ""))
                }
                placeholder="Unlimited"
                className={`${inputBase} tabular-nums`}
              />
            </Field>
          </div>
        </div>

        {/* Validity */}
        <div className="bg-white rounded-2xl border border-brand-line p-3 sm:p-5 space-y-3 sm:space-y-4">
          <h2 className="font-semibold text-brand-ink text-sm">Validity</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <Field label="Starts" hint="Blank = starts now (IST)">
              <input
                type="date"
                value={v.validFrom}
                onChange={(e) => set("validFrom", e.target.value)}
                className={inputBase}
              />
            </Field>
            <Field label="Ends" hint="Blank = no end date (IST)">
              <input
                type="date"
                value={v.validTo}
                onChange={(e) => set("validTo", e.target.value)}
                className={inputBase}
              />
            </Field>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              role="switch"
              aria-checked={v.active}
              aria-label="Active"
              onClick={() => set("active", !v.active)}
              className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                v.active ? "bg-success" : "bg-brand-line"
              }`}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
                  v.active ? "right-0.5" : "left-0.5"
                }`}
              />
            </button>
            <span className="text-sm">
              <span className="font-medium text-brand-ink">
                {v.active ? "Active" : "Inactive"}
              </span>
              <span className="text-brand-ink-soft">
                {" "}
                — {v.active ? "usable at checkout" : "hidden from checkout"}
              </span>
            </span>
          </div>
        </div>

        {error && (
          <p className="text-sm text-brand-red bg-brand-red/5 border border-brand-red/20 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={pending}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-red px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {pending ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <Check size={15} />
            )}
            {mode === "create" ? "Create discount" : "Save changes"}
          </button>
          <Link
            href="/admin/discounts"
            className="inline-flex items-center rounded-lg border border-brand-line px-4 py-2.5 text-sm font-semibold text-brand-ink-soft hover:text-brand-ink"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-brand-ink-soft">
        {label}
      </span>
      {children}
      {hint && <span className="mt-1 block text-xs text-brand-ink-soft">{hint}</span>}
    </label>
  );
}
