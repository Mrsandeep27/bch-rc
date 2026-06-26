import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Shared "Shop by size" catalogue + row renderer, used by BOTH store headers
 * (1:64 main domain and 1:16 prc16 subdomain) so the size switcher stays
 * identical everywhere. Each header passes its own `current` scale: that scale
 * renders as "You're here" (links to its local shop section), the other live
 * scale links cross-domain (absolute URL → full reload across subdomains), and
 * the rest tease as "Coming soon".
 */

export type StoreScale = "1:16" | "1:64";

export type SizeItem = {
  scale: string;
  blurb: string;
  /** present → live & clickable; absent → "Coming soon" */
  href?: string;
  /** absolute cross-domain URL → full reload (plain <a>, not next/link) */
  external?: boolean;
  badge?: string;
};

export const SIZE_TEASER =
  "More sizes dropping soon — stay tuned for a lot more cars & offers.";

// Live stores carry both an absolute cross-domain URL (used when you're on the
// OTHER store) and a local in-app href (used when you're already on it).
const CATALOG: {
  scale: string;
  blurb: string;
  live?: boolean;
  url?: string;
  local?: string;
}[] = [
  { scale: "1:16", blurb: "Big series — 4WD drift, ~28 cm", live: true, url: "https://prc16.pocketrccars.com", local: "/16#lineup" },
  { scale: "1:64", blurb: "Pocket die-cast drift — ₹999", live: true, url: "https://pocketrccars.com/#sku", local: "/#sku" },
  { scale: "1:10", blurb: "XL build" },
  { scale: "1:18", blurb: "Display classic" },
  { scale: "1:24", blurb: "Mid size" },
  { scale: "1:32", blurb: "Compact" },
];

/** Build the size list for a given store, marking the current scale. */
export function getSizes(current: StoreScale): SizeItem[] {
  return CATALOG.map((c) => {
    if (!c.live) return { scale: c.scale, blurb: c.blurb };
    if (c.scale === current)
      return { scale: c.scale, blurb: c.blurb, href: c.local, badge: "You're here" };
    return { scale: c.scale, blurb: c.blurb, href: c.url, external: true, badge: "Live" };
  });
}

/** One row in the size menu. Live scales are links (cross-domain ones are a
 *  plain <a> full-reload); coming-soon scales render muted with a "Soon" badge. */
export function SizeRow({ s, onNavigate }: { s: SizeItem; onNavigate?: () => void }) {
  const live = !!s.href;
  const badgeText = live ? s.badge : "Soon";
  const badgeCls =
    s.badge === "Live"
      ? "bg-green-100 text-green-700"
      : live
        ? "bg-brand-red-soft text-brand-red"
        : "bg-brand-line text-brand-ink-soft";

  const body = (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors",
        live ? "hover:bg-brand-cream" : "cursor-default opacity-55"
      )}
    >
      <span
        className={cn(
          "grid h-9 w-11 shrink-0 place-items-center rounded-lg font-mono text-xs font-bold",
          live ? "bg-brand-red text-white" : "bg-brand-line text-brand-ink-soft"
        )}
      >
        {s.scale}
      </span>
      <span className="block flex-1 truncate text-sm font-medium text-brand-ink">
        {s.blurb}
      </span>
      {badgeText && (
        <span
          className={cn(
            "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
            badgeCls
          )}
        >
          {badgeText}
        </span>
      )}
    </div>
  );

  if (!live) return <div aria-disabled="true">{body}</div>;
  if (s.external)
    return (
      <a href={s.href} onClick={onNavigate} className="block">
        {body}
      </a>
    );
  return (
    <Link href={s.href!} onClick={onNavigate} className="block">
      {body}
    </Link>
  );
}
