"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useInView } from "framer-motion";
import { Truck, Star, MapPin, type LucideIcon } from "lucide-react";

type Stat = {
  icon: LucideIcon;
  target: number;
  suffix: string;
  label: string;
  sub: string;
};

const STATS: Stat[] = [
  {
    icon: Truck,
    target: 10000,
    suffix: "+",
    label: "Cars shipped",
    sub: "Pan-India since 2026",
  },
  {
    icon: Star,
    target: 500,
    suffix: "+",
    label: "5-star reviews",
    sub: "4.9 average rating",
  },
  {
    icon: MapPin,
    target: 50,
    suffix: "+",
    label: "Cities delivered",
    sub: "Metros + Tier 2/3",
  },
];

function formatCount(n: number): string {
  if (n >= 1000) {
    const k = n / 1000;
    return k % 1 === 0 ? `${k}K` : `${k.toFixed(1)}K`;
  }
  return `${n}`;
}

function Counter({ target, suffix, duration = 1.6 }: { target: number; suffix: string; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-30%" });
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!inView) return;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min((now - start) / (duration * 1000), 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setCount(Math.round(eased * target));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, target, duration]);

  return (
    <span ref={ref}>
      {formatCount(count)}
      {suffix}
    </span>
  );
}

export default function StatsStrip() {
  return (
    <section
      className="py-10 sm:py-14 bg-brand-ink text-white"
      aria-label="Trust statistics"
    >
      <div className="max-w-6xl mx-auto px-4 grid grid-cols-3 gap-4 sm:gap-10">
        {STATS.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.12, ease: "easeOut" }}
              className="flex flex-col items-center text-center"
            >
              <Icon className="w-5 h-5 sm:w-6 sm:h-6 text-brand-red mb-2 sm:mb-3" aria-hidden />
              <div className="font-display text-3xl sm:text-5xl font-bold leading-none">
                <Counter target={stat.target} suffix={stat.suffix} />
              </div>
              <div className="font-semibold text-xs sm:text-sm mt-2 sm:mt-3">{stat.label}</div>
              <div className="text-white/55 text-[10px] sm:text-xs mt-0.5 font-mono">
                {stat.sub}
              </div>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
