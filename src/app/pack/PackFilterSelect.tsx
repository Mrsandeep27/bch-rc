"use client";

import { useRouter } from "next/navigation";

/**
 * A styled <select> that navigates to /pack with the chosen filter param,
 * preserving tab + the other filter. Client component purely for onChange →
 * router.push; the options are server-rendered.
 */
export function PackFilterSelect({
  label,
  current,
  paramKey,
  options,
  tab,
  range,
  sort,
}: {
  label: string;
  current: string;
  paramKey: "range" | "sort";
  options: ReadonlyArray<{ value: string; label: string }>;
  tab: string;
  range: string;
  sort: string;
}) {
  const router = useRouter();

  function onChange(value: string) {
    const next = { tab, range, sort, [paramKey]: value };
    router.push(`/pack?tab=${next.tab}&range=${next.range}&sort=${next.sort}`);
  }

  return (
    <label className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs">
      <span className="font-mono uppercase tracking-widest text-white/40">
        {label}
      </span>
      <select
        value={current}
        onChange={(e) => onChange(e.target.value)}
        className="bg-transparent font-semibold text-white focus:outline-none [&>option]:bg-[#1a1a1c] [&>option]:text-white"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
