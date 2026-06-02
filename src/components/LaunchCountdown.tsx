"use client";

import { useEffect, useState } from "react";

/**
 * Real countdown ticking to the next Sunday 23:59:59 IST. Re-rolls weekly so
 * the timer is always live (no "00:00:00" once a sale ends). Renders as 4
 * tight digit blocks: DD HH MM SS.
 *
 * Variant "chip" = inline pill-sized; variant "hero" = larger mono-numbers.
 */

function getDeadline(): number {
  const now = new Date();
  const day = now.getDay(); // 0 = Sunday
  // Days until upcoming Sunday (if it's already Sunday and past 23:59, jump 7)
  const daysUntilSunday = (7 - day) % 7;
  const target = new Date(now);
  target.setDate(now.getDate() + daysUntilSunday);
  target.setHours(23, 59, 59, 999);
  if (target.getTime() <= now.getTime()) {
    target.setDate(target.getDate() + 7);
  }
  return target.getTime();
}

function formatPart(n: number): string {
  return String(Math.max(0, n)).padStart(2, "0");
}

export default function LaunchCountdown({
  variant = "chip",
  className = "",
}: {
  variant?: "chip" | "hero";
  className?: string;
}) {
  const [deadline, setDeadline] = useState<number | null>(null);
  const [now, setNow] = useState<number>(0);

  // Initialize on mount only -- avoids SSR hydration mismatch (server clock !=
  // browser clock, and the deadline depends on the current weekday).
  useEffect(() => {
    setDeadline(getDeadline());
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  if (!deadline) {
    // Server render + first paint -- show frozen 00:00:00:00 to reserve space
    return <CountdownView days={0} hours={0} mins={0} secs={0} variant={variant} className={className} />;
  }

  const diff = Math.max(0, deadline - now);
  const days = Math.floor(diff / 86_400_000);
  const hours = Math.floor((diff % 86_400_000) / 3_600_000);
  const mins = Math.floor((diff % 3_600_000) / 60_000);
  const secs = Math.floor((diff % 60_000) / 1_000);

  return <CountdownView days={days} hours={hours} mins={mins} secs={secs} variant={variant} className={className} />;
}

function CountdownView({
  days,
  hours,
  mins,
  secs,
  variant,
  className,
}: {
  days: number;
  hours: number;
  mins: number;
  secs: number;
  variant: "chip" | "hero";
  className: string;
}) {
  if (variant === "chip") {
    return (
      <span
        className={`inline-flex items-center gap-1 font-mono text-[11px] sm:text-xs font-bold tabular-nums ${className}`}
        aria-label={`Sale ends in ${days} days ${hours} hours ${mins} minutes`}
      >
        <span className="bg-white/15 px-1.5 py-0.5 rounded">{formatPart(days)}d</span>
        <span className="bg-white/15 px-1.5 py-0.5 rounded">{formatPart(hours)}h</span>
        <span className="bg-white/15 px-1.5 py-0.5 rounded">{formatPart(mins)}m</span>
        <span className="bg-white/15 px-1.5 py-0.5 rounded">{formatPart(secs)}s</span>
      </span>
    );
  }
  // Hero variant — bigger blocks
  return (
    <div
      className={`flex items-center gap-2 sm:gap-3 ${className}`}
      aria-label={`Sale ends in ${days} days ${hours} hours ${mins} minutes`}
    >
      {[
        { label: "DAYS", value: days },
        { label: "HRS", value: hours },
        { label: "MIN", value: mins },
        { label: "SEC", value: secs },
      ].map((part) => (
        <div key={part.label} className="flex flex-col items-center">
          <span className="font-display font-bold text-2xl sm:text-3xl text-white leading-none tabular-nums">
            {formatPart(part.value)}
          </span>
          <span className="font-mono text-[8px] sm:text-[9px] uppercase tracking-widest text-white/55 mt-1">
            {part.label}
          </span>
        </div>
      ))}
    </div>
  );
}
