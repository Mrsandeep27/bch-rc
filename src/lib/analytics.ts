/**
 * First-party analytics — pure, EDGE-SAFE helpers shared by the middleware
 * (edge runtime) and the /api/track route (node runtime).
 *
 * IMPORTANT: this module must NOT import anything node-only (no `db`, no
 * `postgres`, no `fs`). The edge middleware imports it. DB work lives in the
 * route handler.
 *
 * Design (see migration 0006_analytics_sessions):
 *  - prc_vid : stable 1-year visitor UUID  → unique-visitor key (per-site).
 *  - prc_sid : 30-min sliding session UUID → session key + conversion denominator.
 * Capture is server-initiated (middleware → /api/track), so ad-blockers, which
 * only intercept browser-issued requests, never see it.
 */

// ---- Cookie names + lifetimes -------------------------------------------------

export const VISITOR_COOKIE = "prc_vid";
export const SESSION_COOKIE = "prc_sid";

/** 30-minute inactivity window — the GA4 / WooCommerce standard. The session
 *  cookie is re-set on every tracked request, so it slides forward while the
 *  visitor stays active and lapses after 30 min idle. */
export const SESSION_TTL_SECONDS = 30 * 60;
/** 1 year. */
export const VISITOR_TTL_SECONDS = 365 * 24 * 60 * 60;

/** A session counts as "live" if seen within this window. */
export const LIVE_WINDOW_MINUTES = 5;

export const UTM_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
] as const;

// ---- Bot filtering ------------------------------------------------------------

/**
 * Conservative crawler/bot UA match. Known crawlers are still stored (is_bot
 * = true) but excluded from every dashboard count — bot inflation is the main
 * accuracy pitfall of server-side tracking, so we filter rather than trust the
 * raw number. Kept deliberately broad on the obvious offenders; behavioural
 * bot detection is out of scope for v1.
 */
const BOT_UA_RE =
  /bot|crawl|spider|slurp|bingpreview|facebookexternalhit|facebot|embedly|quora link preview|whatsapp|telegrambot|discordbot|pinterest|vkshare|ia_archiver|semrush|ahrefs|mj12|dotbot|petalbot|bytespider|gptbot|claudebot|ccbot|google-?inspectiontool|chrome-lighthouse|headlesschrome|python-requests|curl\/|wget\/|axios\/|node-fetch|go-http-client|httpclient|monitis|uptimerobot|pingdom|datadog|newrelic/i;

export function isBotUA(ua: string | null | undefined): boolean {
  if (!ua) return true; // no UA at all → almost always a bot/script
  return BOT_UA_RE.test(ua);
}

// ---- Source classification (last-click, first-touch persisted) ---------------

export type TrafficSource =
  | "direct"
  | "organic"
  | "social"
  | "paid"
  | "email"
  | "referral";

const SEARCH_HOSTS =
  /(^|\.)(google|bing|yahoo|duckduckgo|ecosia|baidu|yandex|brave|qwant|startpage)\./i;
const SOCIAL_HOSTS =
  /(^|\.)(facebook|fb|instagram|t\.co|twitter|x|youtube|youtu\.be|linkedin|pinterest|reddit|whatsapp|wa\.me|telegram|t\.me|snapchat|tiktok|threads)\./i;

/**
 * Classify an acquisition source from UTM + referrer, last-click style.
 * UTM medium wins (explicit campaign tagging), then the referrer host, then
 * direct. The store's own host is treated as direct (internal navigation must
 * never look like a referral).
 */
export function classifySource(input: {
  utmMedium?: string | null;
  utmSource?: string | null;
  referrerHost?: string | null;
  selfHost?: string | null;
}): TrafficSource {
  const medium = (input.utmMedium ?? "").toLowerCase();
  if (medium) {
    if (/cpc|ppc|paid|paidsearch|display|cpm|banner|retargeting/.test(medium))
      return "paid";
    if (/email|newsletter|e-?mail/.test(medium)) return "email";
    if (/social|social-?paid|paid-?social/.test(medium)) return "social";
    if (/organic/.test(medium)) return "organic";
    if (/referral/.test(medium)) return "referral";
    // Tagged but unrecognised medium → treat as referral (it's a campaign).
    return "referral";
  }
  // A UTM source without a medium (common on social shares) → social if it
  // looks social, else referral.
  if (input.utmSource) {
    if (SOCIAL_HOSTS.test(input.utmSource)) return "social";
    return "referral";
  }

  const ref = (input.referrerHost ?? "").toLowerCase();
  if (!ref) return "direct";
  if (input.selfHost && ref === input.selfHost.toLowerCase()) return "direct";
  if (SEARCH_HOSTS.test(ref)) return "organic";
  if (SOCIAL_HOSTS.test(ref)) return "social";
  return "referral";
}

/** Human label for the dashboard. */
export const SOURCE_LABEL: Record<TrafficSource, string> = {
  direct: "Direct / typed-in",
  organic: "Organic search",
  social: "Social",
  paid: "Paid ads",
  email: "Email",
  referral: "Referral",
};

// ---- Misc parsing -------------------------------------------------------------

/** Extract the bare host from a referrer URL. Returns null on empty/invalid. */
export function referrerHostOf(referrer: string | null | undefined): string | null {
  if (!referrer) return null;
  try {
    return new URL(referrer).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

/**
 * Whether a path should be counted as a storefront pageview. Excludes the
 * admin app, the COD operator console, API routes, Next internals, and static
 * assets. Everything else (home, product pages, checkout, policies, track) is
 * a real customer-facing view.
 */
export function shouldTrackPath(pathname: string): boolean {
  if (!pathname || pathname === "") return false;
  return !(
    pathname.startsWith("/api") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/cod") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/monitoring") ||
    pathname === "/favicon.ico" ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml" ||
    /\.[a-z0-9]+$/i.test(pathname) // any file extension (.png, .ico, .js, ...)
  );
}
