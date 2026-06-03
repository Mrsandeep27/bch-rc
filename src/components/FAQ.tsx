"use client";

import { useState } from "react";
import { Plus, Minus } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { HOME_FAQS, type QA } from "@/lib/faqs";

function Item({
  qa,
  isOpen,
  onToggle,
}: {
  qa: QA;
  isOpen: boolean;
  onToggle: () => void;
}) {
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
  // Closed by default — user prefers a compact section, buyers tap to expand
  // the one they care about.
  const [openIdxs, setOpenIdxs] = useState<Set<number>>(new Set());
  const [showAll, setShowAll] = useState(false);

  const visibleFaqs = showAll ? HOME_FAQS : HOME_FAQS.slice(0, VISIBLE_COUNT);
  const hiddenCount = HOME_FAQS.length - VISIBLE_COUNT;

  const toggle = (i: number) => {
    setOpenIdxs((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  return (
    <section id="faq" className="py-8 sm:py-14 bg-white">
      <div className="max-w-3xl mx-auto px-4">
        <div className="text-center">
          <span className="font-mono text-xs uppercase tracking-widest text-brand-red">
            Frequently asked
          </span>
          <h2 className="font-display text-3xl sm:text-5xl font-bold text-brand-ink mt-2 text-balance">
            The honest answers.
          </h2>
        </div>

        <div className="mt-6 sm:mt-10">
          {visibleFaqs.map((qa, i) => (
            <Item
              key={qa.q}
              qa={qa}
              isOpen={openIdxs.has(i)}
              onToggle={() => toggle(i)}
            />
          ))}
        </div>

        {hiddenCount > 0 && (
          <div className="mt-8 text-center">
            <button
              type="button"
              onClick={() => setShowAll((prev) => !prev)}
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
