"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { X } from "lucide-react";
import { getVisibleProducts } from "@/lib/products";

type Sale = {
  city: string;
  name: string;
  skuId: string;
  agoLabel: string;
};

const CITIES = [
  "Bangalore",
  "Mumbai",
  "Pune",
  "Hyderabad",
  "Delhi",
  "Chennai",
  "Kolkata",
  "Ahmedabad",
  "Jaipur",
  "Indore",
];
const FIRST_NAMES = [
  "Priya",
  "Rahul",
  "Aarav",
  "Anaya",
  "Vikram",
  "Sneha",
  "Karthik",
  "Meera",
  "Rohan",
  "Diya",
  "Aditya",
  "Ishaan",
];
const AGOS = ["2 min ago", "6 min ago", "12 min ago", "just now", "18 min ago", "an hour ago"];

function pick<T>(arr: T[], i: number): T {
  return arr[i % arr.length];
}

function buildSchedule(): Sale[] {
  const visible = getVisibleProducts();
  // Generate 8 deterministic "sales" (no Math.random — keeps SSR stable)
  return Array.from({ length: 8 }, (_, i) => {
    const sku = visible[i % visible.length];
    return {
      city: pick(CITIES, i * 3 + 1),
      name: pick(FIRST_NAMES, i * 2 + 1),
      skuId: sku.id,
      agoLabel: pick(AGOS, i + 2),
    };
  });
}

/**
 * Bottom-left rotating "Priya from Pune just ordered the Pocket Porsche"
 * toast. Cycles 8 deterministic entries every ~10s, with a 4s pause between
 * cards. Dismissible (closed = hidden for the rest of the session).
 */
export default function SocialProofToast() {
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [idx, setIdx] = useState(0);
  const [schedule] = useState<Sale[]>(() => buildSchedule());

  useEffect(() => {
    if (dismissed) return;
    // First show after 6s
    const firstShow = window.setTimeout(() => setVisible(true), 6000);
    return () => window.clearTimeout(firstShow);
  }, [dismissed]);

  useEffect(() => {
    if (!visible || dismissed) return;
    // Each cycle: show 6s, hide 3s, advance
    const hideT = window.setTimeout(() => setVisible(false), 6000);
    const advanceT = window.setTimeout(() => {
      setIdx((i) => (i + 1) % schedule.length);
      setVisible(true);
    }, 9000);
    return () => {
      window.clearTimeout(hideT);
      window.clearTimeout(advanceT);
    };
  }, [visible, idx, schedule.length, dismissed]);

  if (dismissed) return null;
  const sale = schedule[idx];
  const sku = getVisibleProducts().find((p) => p.id === sale.skuId);
  if (!sku) return null;

  return (
    <div
      aria-live="polite"
      className={`fixed bottom-24 sm:bottom-6 left-3 sm:left-6 z-30 transition-all duration-500 ${
        visible
          ? "translate-y-0 opacity-100"
          : "translate-y-4 opacity-0 pointer-events-none"
      }`}
    >
      <div className="bg-white rounded-xl shadow-2xl border border-brand-line p-3 pr-9 flex items-center gap-3 max-w-[280px] sm:max-w-xs relative">
        <div className="relative w-11 h-11 shrink-0 rounded-lg overflow-hidden bg-brand-cream border border-brand-line">
          <Image
            src={sku.heroImage}
            alt={sku.name}
            fill
            sizes="44px"
            className="object-contain"
          />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-brand-ink leading-tight">
            <strong className="font-semibold">{sale.name}</strong> from{" "}
            <strong className="font-semibold">{sale.city}</strong>
          </p>
          <p className="text-[11px] text-brand-ink-soft mt-0.5 leading-snug truncate">
            ordered the {sku.name}
          </p>
          <p className="text-[10px] font-mono uppercase tracking-widest text-success mt-0.5">
            ✓ Verified · {sale.agoLabel}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss"
          className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full hover:bg-brand-cream flex items-center justify-center text-brand-ink-soft hover:text-brand-ink"
        >
          <X size={12} />
        </button>
      </div>
    </div>
  );
}
