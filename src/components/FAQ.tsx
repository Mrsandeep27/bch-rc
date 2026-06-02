"use client";

import { useState } from "react";
import { Plus, Minus } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

type QA = { q: string; a: string };

const FAQS: QA[] = [
  {
    q: "Is this really 1:64 scale? How small is it?",
    a: "Yes — 1:64 is the same scale as Hot Wheels. The car is around 7 cm long and fits in your palm. It's the only fully-functional RC at this size in India.",
  },
  {
    q: "How fast does it actually drift?",
    a: "On smooth surfaces (tile, marble, hardwood) it hits ~15 km/h scale-speed and slides into proper drift turns. Drift wheels (included) make rear-end loose for controlled slides.",
  },
  {
    q: "How long does the battery last per charge?",
    a: "15-20 minutes of continuous driving on a full charge. USB-C charging takes about 30 minutes from empty to full.",
  },
  {
    q: "What's in the box?",
    a: "1 car · 1 transmitter (2.4 GHz, needs 2× AAA batteries — not included) · USB-C charging cable · 1 set of standard wheels · 1 set of drift wheels · user guide.",
  },
  {
    q: "Is it safe for kids? What age?",
    a: "Recommended 8+. Small parts (wheels, antenna) — not suitable for under-3s. Body is die-cast alloy + ABS, BIS-certified for Indian safety standards.",
  },
  {
    q: "Does it work outdoors?",
    a: "Best indoors on smooth floors. Works on smooth outdoor surfaces (paved courtyards, terrace tiles) but the wheels won't grip grass, sand, or rough concrete. Not waterproof.",
  },
  {
    q: "What if it breaks? Do you have spares?",
    a: "30-day replacement on manufacturing defects. Spare wheels, batteries, and chassis parts are stocked at the Bangalore HQ and shipped within 48 hours.",
  },
  {
    q: "How fast is shipping?",
    a: "Dispatched in 24 hours from Bangalore via Shiprocket. Delivery: 2-4 days metros · 4-7 days rest of India. Tracking link sent on WhatsApp + email.",
  },
  {
    q: "Do you ship COD? Any extra fee?",
    a: "Yes — COD available pan-India. ₹49 COD fee on orders under ₹999. Free on everything else. Prepaid orders get ₹100 off.",
  },
  {
    q: "Can I return it if I don't like it?",
    a: "7-day no-questions-asked return on unused/sealed boxes. Refund hits your account within 3-5 business days after we receive the return.",
  },
];

function Item({ qa, isOpen, onToggle }: { qa: QA; isOpen: boolean; onToggle: () => void }) {
  return (
    <div className="border-b border-brand-line last:border-b-0">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-start justify-between gap-4 py-5 sm:py-6 text-left group"
        aria-expanded={isOpen}
      >
        <span className="font-semibold text-brand-ink text-base sm:text-lg leading-snug group-hover:text-brand-red transition-colors">
          {qa.q}
        </span>
        <span
          className={cn(
            "shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition-colors",
            isOpen ? "bg-brand-red text-white" : "bg-brand-cream text-brand-ink"
          )}
        >
          {isOpen ? <Minus size={14} /> : <Plus size={14} />}
        </span>
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <p className="text-brand-ink-soft text-sm sm:text-base leading-relaxed pb-6 pr-10">
              {qa.a}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const VISIBLE_COUNT = 2;

export default function FAQ() {
  const [openIdx, setOpenIdx] = useState<number | null>(0);
  const [showAll, setShowAll] = useState(false);

  const visibleFaqs = showAll ? FAQS : FAQS.slice(0, VISIBLE_COUNT);
  const hiddenCount = FAQS.length - VISIBLE_COUNT;

  return (
    <section id="faq" className="py-8 sm:py-14 bg-white">
      <div className="max-w-3xl mx-auto px-4">
        <div className="text-center">
          <span className="font-mono text-xs uppercase tracking-widest text-brand-red">
            Frequently asked
          </span>
          <h2 className="font-display text-3xl sm:text-5xl font-bold text-brand-ink mt-2 text-balance">
            Everything you wanted to know.
          </h2>
        </div>

        <div className="mt-6 sm:mt-10">
          {visibleFaqs.map((qa, i) => (
            <Item
              key={qa.q}
              qa={qa}
              isOpen={openIdx === i}
              onToggle={() => setOpenIdx(openIdx === i ? null : i)}
            />
          ))}
        </div>

        {hiddenCount > 0 && (
          <div className="mt-8 text-center">
            <button
              type="button"
              onClick={() => {
                setShowAll((prev) => !prev);
                setOpenIdx(null);
              }}
              className="inline-flex items-center gap-2 rounded-full border border-brand-line px-6 py-3 text-sm font-semibold text-brand-ink hover:border-brand-red hover:text-brand-red transition-colors"
            >
              {showAll
                ? "Show fewer questions"
                : `Show ${hiddenCount} more question${hiddenCount === 1 ? "" : "s"}`}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
