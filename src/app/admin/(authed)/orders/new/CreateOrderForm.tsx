"use client";

import { useMemo, useState, useTransition } from "react";
import {
  Check,
  Copy,
  Loader2,
  AlertCircle,
  ExternalLink,
  Plus,
  Minus,
} from "lucide-react";
import { formatINR } from "@/lib/utils";

type SkuOption = {
  id: string;
  name: string;
  retailINR: number;
  heroImage: string;
  colors?: { name: string; slug: string; stock: number }[];
};

type CreateOrderResponse = {
  ok: true;
  orderId: string;
  paymentLink: string;
  paymentLinkId: string;
  total: number;
  customer: { name: string; phone: string; email: string | null };
};

export function CreateOrderForm({ products }: { products: SkuOption[] }) {
  // ── Form state ───────────────────────────────────────────────
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [line1, setLine1] = useState("");
  const [line2, setLine2] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [pincode, setPincode] = useState("");

  const [skuId, setSkuId] = useState(products[0]?.id ?? "");
  const [variantSlug, setVariantSlug] = useState<string | null>(
    products[0]?.colors?.[0]?.slug ?? null,
  );
  const [qty, setQty] = useState(1);

  const [discountPct, setDiscountPct] = useState(0);
  const [notes, setNotes] = useState("");

  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CreateOrderResponse | null>(null);
  const [copied, setCopied] = useState(false);

  const selectedSku = useMemo(
    () => products.find((p) => p.id === skuId) ?? null,
    [products, skuId],
  );
  const selectedVariant = useMemo(
    () => selectedSku?.colors?.find((c) => c.slug === variantSlug) ?? null,
    [selectedSku, variantSlug],
  );

  // ── Derived totals (must match the server's compute exactly) ─
  const FREE_SHIPPING_AT = 1099;
  const subtotal = (selectedSku?.retailINR ?? 0) * qty;
  const shipping = subtotal >= FREE_SHIPPING_AT ? 0 : 85;
  const grossBeforeDiscount = subtotal + shipping;
  const discountInr = Math.round((grossBeforeDiscount * discountPct) / 100);
  const total = Math.max(0, grossBeforeDiscount - discountInr);

  function reset() {
    setResult(null);
    setError(null);
    setCopied(false);
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCopied(false);

    if (selectedSku?.colors?.length && !variantSlug) {
      setError("Pick a colour for the product.");
      return;
    }

    startTransition(async () => {
      try {
        const res = await fetch("/api/admin/orders/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            siteId: "prc",
            customer: {
              fullName: fullName.trim(),
              phone: phone.trim(),
              email: email.trim() || undefined,
              line1: line1.trim(),
              line2: line2.trim() || undefined,
              city: city.trim(),
              state: state.trim(),
              pincode: pincode.trim(),
            },
            items: [
              {
                skuId,
                variantSlug: selectedSku?.colors?.length ? variantSlug : null,
                qty,
              },
            ],
            discountPct,
            notes: notes.trim() || undefined,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          const detail =
            typeof data === "object" && data !== null && "error" in data
              ? String(data.error)
              : `Status ${res.status}`;
          setError(detail);
          return;
        }
        setResult(data as CreateOrderResponse);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    });
  }

  async function copyLink() {
    if (!result) return;
    await navigator.clipboard.writeText(result.paymentLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  // ── Success state ────────────────────────────────────────────
  if (result) {
    const waMessage = encodeURIComponent(
      `Hi ${result.customer.name}, your PRC Cars order ${result.orderId} ` +
        `for ${formatINR(result.total)} is ready. Tap to pay:\n${result.paymentLink}\n\n` +
        `Thanks!`,
    );
    const waLink = `https://wa.me/91${result.customer.phone}?text=${waMessage}`;
    return (
      <div className="bg-white rounded-2xl border border-brand-line p-6 max-w-2xl">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-9 h-9 rounded-full bg-green-100 text-green-700 flex items-center justify-center">
            <Check size={18} />
          </div>
          <div>
            <div className="font-bold text-lg">Order created</div>
            <div className="text-sm text-brand-ink-soft">
              {result.orderId} · {formatINR(result.total)}
            </div>
          </div>
        </div>
        <div className="bg-brand-cream rounded-xl p-4 mb-4">
          <div className="text-xs font-mono uppercase tracking-widest text-brand-ink-soft mb-1.5">
            Razorpay payment link
          </div>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-sm bg-white border border-brand-line rounded-lg px-3 py-2 font-mono truncate">
              {result.paymentLink}
            </code>
            <button
              type="button"
              onClick={copyLink}
              className="shrink-0 px-3 py-2 border border-brand-line rounded-lg hover:bg-white inline-flex items-center gap-1.5 text-sm font-semibold"
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <p className="text-xs text-brand-ink-soft mt-2">
            Razorpay has already sent SMS + email to{" "}
            <strong>+91 {result.customer.phone}</strong>
            {result.customer.email ? <> + <strong>{result.customer.email}</strong></> : null}.
            They&rsquo;ll also be reminded 24h before the link expires (48h total).
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <a
            href={waLink}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 bg-whatsapp-green hover:bg-whatsapp-green-hover text-white py-3 rounded-xl font-semibold text-sm inline-flex items-center justify-center gap-2"
          >
            <ExternalLink size={14} />
            Send via my WhatsApp
          </a>
          <a
            href={`/admin/orders/${result.orderId}`}
            className="flex-1 bg-brand-ink hover:bg-black text-white py-3 rounded-xl font-semibold text-sm inline-flex items-center justify-center gap-2"
          >
            View order
          </a>
          <button
            type="button"
            onClick={() => {
              reset();
              setFullName("");
              setPhone("");
              setEmail("");
              setLine1("");
              setLine2("");
              setCity("");
              setState("");
              setPincode("");
              setNotes("");
              setQty(1);
              setDiscountPct(0);
            }}
            className="flex-1 border-2 border-brand-line text-brand-ink hover:bg-brand-cream py-3 rounded-xl font-semibold text-sm"
          >
            + New order
          </button>
        </div>
      </div>
    );
  }

  // ── Form ────────────────────────────────────────────────────
  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <Section title="Customer">
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Full name" required>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              minLength={2}
              maxLength={120}
              className={inputCls}
            />
          </Field>
          <Field label="Phone (10-digit)" required>
            <div className="flex items-center">
              <span className="px-3 py-3 border-2 border-r-0 border-brand-line rounded-l-xl bg-brand-cream text-sm font-mono">
                +91
              </span>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                required
                pattern="[0-9]{10}"
                inputMode="numeric"
                placeholder="9xxxxxxxxx"
                className={`${inputCls} rounded-l-none border-l-0`}
              />
            </div>
          </Field>
          <Field label="Email (optional)" className="sm:col-span-2">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              maxLength={160}
              placeholder="customer@example.com"
              className={inputCls}
            />
          </Field>
          <Field label="Address line 1" required className="sm:col-span-2">
            <input
              type="text"
              value={line1}
              onChange={(e) => setLine1(e.target.value)}
              required
              maxLength={200}
              placeholder="House / building, street"
              className={inputCls}
            />
          </Field>
          <Field label="Address line 2 (optional)" className="sm:col-span-2">
            <input
              type="text"
              value={line2}
              onChange={(e) => setLine2(e.target.value)}
              maxLength={200}
              placeholder="Landmark, area"
              className={inputCls}
            />
          </Field>
          <Field label="City" required>
            <input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              required
              maxLength={80}
              className={inputCls}
            />
          </Field>
          <Field label="State" required>
            <input
              type="text"
              value={state}
              onChange={(e) => setState(e.target.value)}
              required
              maxLength={80}
              className={inputCls}
            />
          </Field>
          <Field label="Pincode (6-digit)" required>
            <input
              type="text"
              value={pincode}
              onChange={(e) => setPincode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              required
              pattern="[0-9]{6}"
              inputMode="numeric"
              className={inputCls}
            />
          </Field>
        </div>
      </Section>

      <Section title="Product">
        <div className="grid sm:grid-cols-3 gap-3">
          <Field label="Product" required>
            <select
              value={skuId}
              onChange={(e) => {
                setSkuId(e.target.value);
                const next = products.find((p) => p.id === e.target.value);
                setVariantSlug(next?.colors?.[0]?.slug ?? null);
              }}
              required
              className={inputCls}
            >
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · {formatINR(p.retailINR)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Colour" required={!!selectedSku?.colors?.length}>
            {selectedSku?.colors?.length ? (
              <select
                value={variantSlug ?? ""}
                onChange={(e) => setVariantSlug(e.target.value)}
                required
                className={inputCls}
              >
                {selectedSku.colors.map((c) => (
                  <option key={c.slug} value={c.slug} disabled={c.stock <= 0}>
                    {c.name} {c.stock <= 0 ? "(sold out)" : `· ${c.stock} in stock`}
                  </option>
                ))}
              </select>
            ) : (
              <input
                value="No colour variants"
                disabled
                className={`${inputCls} text-brand-ink-soft`}
              />
            )}
          </Field>
          <Field label="Qty">
            <div className="flex items-center border-2 border-brand-line rounded-xl">
              <button
                type="button"
                onClick={() => setQty(Math.max(1, qty - 1))}
                className="w-11 h-11 flex items-center justify-center text-brand-ink-soft hover:text-brand-ink"
              >
                <Minus size={14} />
              </button>
              <span className="flex-1 text-center font-semibold">{qty}</span>
              <button
                type="button"
                onClick={() => setQty(Math.min(selectedVariant?.stock ?? 20, qty + 1))}
                className="w-11 h-11 flex items-center justify-center text-brand-ink-soft hover:text-brand-ink"
              >
                <Plus size={14} />
              </button>
            </div>
          </Field>
        </div>
      </Section>

      <Section title="Discount + notes (optional)">
        <div className="grid sm:grid-cols-3 gap-3">
          <Field label="Direct-call discount %">
            <div className="flex items-center border-2 border-brand-line rounded-xl">
              <input
                type="number"
                value={discountPct}
                onChange={(e) =>
                  setDiscountPct(
                    Math.max(0, Math.min(50, Math.floor(Number(e.target.value) || 0))),
                  )
                }
                min={0}
                max={50}
                step={1}
                className="flex-1 px-3 py-2.5 bg-transparent outline-none"
              />
              <span className="px-3 text-brand-ink-soft text-sm">%</span>
            </div>
          </Field>
          <Field label="Internal note" className="sm:col-span-2">
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={500}
              placeholder="e.g. WhatsApp'd by Syed, prefers Sat delivery"
              className={inputCls}
            />
          </Field>
        </div>
      </Section>

      <Section title="Summary">
        <dl className="grid grid-cols-2 gap-y-1.5 text-sm">
          <dt className="text-brand-ink-soft">Subtotal</dt>
          <dd className="text-right font-semibold">{formatINR(subtotal)}</dd>
          <dt className="text-brand-ink-soft">
            Shipping {shipping === 0 ? "(free)" : ""}
          </dt>
          <dd className="text-right">{formatINR(shipping)}</dd>
          {discountInr > 0 ? (
            <>
              <dt className="text-green-700">Discount ({discountPct}%)</dt>
              <dd className="text-right text-green-700">−{formatINR(discountInr)}</dd>
            </>
          ) : null}
          <dt className="text-base font-bold mt-2 pt-2 border-t border-brand-line">
            Total
          </dt>
          <dd className="text-right text-base font-bold mt-2 pt-2 border-t border-brand-line">
            {formatINR(total)}
          </dd>
        </dl>
      </Section>

      {error && (
        <div className="flex items-start gap-2 text-sm text-brand-red bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={pending}
          className="bg-brand-red hover:bg-brand-red-hover text-white px-6 py-3.5 rounded-xl font-bold inline-flex items-center gap-2 disabled:opacity-50"
        >
          {pending ? <Loader2 size={16} className="animate-spin" /> : null}
          {pending ? "Creating order…" : `Generate payment link · ${formatINR(total)}`}
        </button>
      </div>
    </form>
  );
}

// ── small UI helpers ─────────────────────────────────────────────
const inputCls =
  "w-full px-3 py-2.5 border-2 border-brand-line rounded-xl bg-white text-sm outline-none focus:border-brand-ink";

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-white rounded-2xl border border-brand-line p-4 sm:p-5">
      <h2 className="font-display font-bold text-base mb-3">{title}</h2>
      {children}
    </section>
  );
}

function Field({
  label,
  required,
  children,
  className,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className ?? ""}`}>
      <span className="text-xs font-mono uppercase tracking-widest text-brand-ink-soft mb-1 block">
        {label} {required ? <span className="text-brand-red">*</span> : null}
      </span>
      {children}
    </label>
  );
}
