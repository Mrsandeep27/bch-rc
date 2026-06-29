"use client";

import { useRouter, useSearchParams } from "next/navigation";

/**
 * Store selector for the Overview dashboard. "All" (no ?site=) shows every site
 * the admin manages combined; picking a site scopes every metric on the page to
 * that store. Preserves the current ?range= so the two toggles compose. Only
 * rendered when the admin manages more than one site (see page.tsx).
 */
export function StoreTabs({ sites }: { sites: string[] }) {
  const router = useRouter();
  const sp = useSearchParams();
  const current = sp.get("site");

  function go(site: string | null) {
    const params = new URLSearchParams(sp.toString());
    if (site) params.set("site", site);
    else params.delete("site");
    const qs = params.toString();
    router.push(qs ? `/admin?${qs}` : "/admin");
  }

  const pill = (active: boolean) =>
    `px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
      active
        ? "bg-brand-ink text-white"
        : "text-brand-ink-soft hover:text-brand-ink"
    }`;

  return (
    <div className="flex gap-1 bg-brand-cream rounded-full p-1 shrink-0 overflow-x-auto no-scrollbar max-w-full">
      <button
        type="button"
        onClick={() => go(null)}
        aria-pressed={current === null}
        className={pill(current === null)}
      >
        All
      </button>
      {sites.map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => go(s)}
          aria-pressed={current === s}
          className={`${pill(current === s)} uppercase`}
        >
          {s}
        </button>
      ))}
    </div>
  );
}
