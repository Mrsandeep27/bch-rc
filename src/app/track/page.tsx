"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  Package,
  Truck,
  CheckCircle2,
  Search,
  AlertCircle,
} from "lucide-react";
import { AnnouncementBar } from "@/components/AnnouncementBar";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import WhatsAppFab from "@/components/WhatsAppFab";
import CartDrawer from "@/components/CartDrawer";
import { WhatsAppIcon } from "@/components/BrandIcons";
import { THEME } from "@/lib/theme";
import { waLink } from "@/lib/config";

// Stub status pipeline — replaced with real Shiprocket webhook data once the
// backend is wired. For now: enter any order ID matching the pattern PRC-XXXX
// and see a sample 4-step journey.
type Step = {
  key: "placed" | "packed" | "shipped" | "delivered";
  label: string;
  sub: string;
  icon: typeof Package;
};

const STEPS: Step[] = [
  { key: "placed", label: "Order placed", sub: "Confirmed + payment verified", icon: CheckCircle2 },
  { key: "packed", label: "Packed", sub: "Boxed at Yelahanka warehouse", icon: Package },
  { key: "shipped", label: "Out for delivery", sub: "Shiprocket courier en route", icon: Truck },
  { key: "delivered", label: "Delivered", sub: "Enjoy your drift!", icon: CheckCircle2 },
];

export default function TrackPage() {
  const [input, setInput] = useState("");
  const [submitted, setSubmitted] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const id = input.trim().toUpperCase();
    if (!id) {
      setError("Enter an order ID to track.");
      return;
    }
    if (!/^PRC-[A-Z0-9]{4,12}$/.test(id)) {
      setError("Order IDs look like PRC-XXXXXXXX (the format on your WhatsApp confirmation).");
      return;
    }
    setError(null);
    setSubmitted(id);
  }

  // Stub: deterministic "current step" based on the order ID length so the
  // demo feels real. Real order pipeline lands when Supabase + Shiprocket
  // webhooks are wired.
  const currentStep = submitted
    ? ((submitted.length + 1) % STEPS.length) as 0 | 1 | 2 | 3
    : -1;

  return (
    <>
      <AnnouncementBar />
      <Header />
      <nav className="border-b border-brand-line bg-white">
        <div className="max-w-3xl mx-auto px-4 py-3">
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-sm text-brand-ink-soft hover:text-brand-ink"
          >
            <ChevronLeft size={16} />
            Back to store
          </Link>
        </div>
      </nav>

      <main className="flex-1 bg-white">
        <section className="max-w-3xl mx-auto px-4 py-8 sm:py-14">
          <p className="text-xs font-mono font-bold uppercase tracking-widest text-brand-red">
            Track your order
          </p>
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-brand-ink mt-2 text-balance">
            Where&apos;s my drift?
          </h1>
          <p className="text-base text-brand-ink-soft mt-3 leading-relaxed">
            Enter the order ID from your WhatsApp / SMS confirmation. Looks like{" "}
            <span className="font-mono text-brand-ink">PRC-XXXXXXXX</span>.
          </p>

          <form
            onSubmit={handleSubmit}
            className="mt-6 flex flex-col sm:flex-row gap-3"
          >
            <div className="relative flex-1">
              <Search
                size={18}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-ink-soft pointer-events-none"
              />
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="PRC-A1B2C3D4"
                aria-label="Order ID"
                className="w-full pl-11 pr-4 py-3 sm:py-4 rounded-xl border-2 border-brand-line focus:border-brand-red focus:outline-none text-brand-ink placeholder:text-brand-ink-soft/50 font-mono text-base uppercase tracking-widest"
              />
            </div>
            <button
              type="submit"
              className="bg-brand-red hover:bg-brand-red-hover text-white px-6 py-3 sm:py-4 rounded-xl font-bold text-base transition-colors"
            >
              Track
            </button>
          </form>

          {error && (
            <p className="mt-3 inline-flex items-center gap-1.5 text-sm text-brand-red font-medium">
              <AlertCircle size={14} />
              {error}
            </p>
          )}

          {submitted && (
            <div className="mt-8 border border-brand-line rounded-2xl p-5 sm:p-7 bg-white">
              <div className="flex items-baseline justify-between gap-3 mb-5">
                <div>
                  <p className="text-[10px] font-mono uppercase tracking-widest text-brand-ink-soft">
                    Order
                  </p>
                  <p className="font-display text-xl font-bold text-brand-ink font-mono mt-0.5">
                    {submitted}
                  </p>
                </div>
                <span className="bg-success/10 text-success text-[11px] font-mono uppercase tracking-widest font-semibold px-2.5 py-1 rounded-full">
                  Active
                </span>
              </div>

              {/* Step pipeline */}
              <ol className="space-y-3">
                {STEPS.map((step, i) => {
                  const done = i <= currentStep;
                  const active = i === currentStep;
                  const Icon = step.icon;
                  return (
                    <li
                      key={step.key}
                      className={`flex items-start gap-4 p-3 rounded-xl border transition-colors ${
                        active
                          ? "border-brand-red bg-brand-red-soft"
                          : done
                          ? "border-success/30 bg-success/5"
                          : "border-brand-line bg-white"
                      }`}
                    >
                      <span
                        className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center ${
                          active
                            ? "bg-brand-red text-white"
                            : done
                            ? "bg-success text-white"
                            : "bg-brand-cream text-brand-ink-soft"
                        }`}
                      >
                        <Icon size={16} />
                      </span>
                      <div className="flex-1 min-w-0">
                        <p
                          className={`text-sm font-semibold ${
                            done || active ? "text-brand-ink" : "text-brand-ink-soft"
                          }`}
                        >
                          {step.label}
                        </p>
                        <p className="text-xs text-brand-ink-soft mt-0.5">
                          {step.sub}
                        </p>
                      </div>
                      {active && (
                        <span className="text-[10px] font-mono uppercase tracking-widest text-brand-red font-bold animate-pulse">
                          Now
                        </span>
                      )}
                    </li>
                  );
                })}
              </ol>

              <div className="mt-5 pt-5 border-t border-brand-line">
                <p className="text-xs text-brand-ink-soft">
                  Need help? WhatsApp us with your order ID and we&apos;ll check
                  with the courier directly.
                </p>
                <a
                  href={waLink(
                    `Hi, I need an update on my order ${submitted}.`
                  )}
                  target="_blank"
                  rel="noopener"
                  className="mt-3 inline-flex items-center gap-2 bg-whatsapp-green hover:bg-whatsapp-green-hover text-white px-4 py-2.5 rounded-full font-semibold text-sm transition-colors"
                >
                  <WhatsAppIcon size={16} />
                  Chat about this order
                </a>
              </div>
            </div>
          )}

          {/* Sub-help block */}
          <div className="mt-10 border-t border-brand-line pt-6">
            <p className="text-xs font-mono font-bold uppercase tracking-widest text-brand-red">
              Can&apos;t find your order ID?
            </p>
            <p className="text-sm text-brand-ink-soft mt-2 leading-relaxed">
              Check the WhatsApp confirmation we sent to{" "}
              <span className="font-semibold text-brand-ink">{THEME.phoneDisplay}</span>{" "}
              after your order. The ID is in the first message and looks like{" "}
              <span className="font-mono text-brand-ink">PRC-XXXXXXXX</span>.
              <br />
              <br />
              Still stuck? WhatsApp us your name + delivery PIN and we&apos;ll
              find it.
            </p>
          </div>
        </section>
      </main>

      <Footer />
      <WhatsAppFab />
      <CartDrawer />
    </>
  );
}
