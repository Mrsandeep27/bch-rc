/**
 * Next.js middleware. Two jobs:
 *  1. Refresh the Supabase session cookie on every request (without this, SSR
 *     pages won't see the logged-in user).
 *  2. First-party visitor analytics — assign/refresh the visitor (prc_vid) and
 *     session (prc_sid) cookies and record the pageview by calling /api/track
 *     SERVER-TO-SERVER via event.waitUntil. Because the browser never issues
 *     that request, ad-blockers can't strip it — the main accuracy win over
 *     client-side analytics.
 *
 * Runs on the edge runtime, so it must not touch postgres-js directly; the DB
 * write happens in the node /api/track route.
 */

import { createServerClient } from "@supabase/ssr";
import {
  NextResponse,
  type NextRequest,
  type NextFetchEvent,
} from "next/server";
import {
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  VISITOR_COOKIE,
  VISITOR_TTL_SECONDS,
  UTM_KEYS,
  shouldTrackPath,
} from "@/lib/analytics";

// MAINTENANCE MODE — gated by env var. Runs BEFORE Supabase/analytics so a
// paused site doesn't waste a DB round-trip on every request. Toggle via
// Vercel dashboard: set MAINTENANCE_MODE=true → site rewrites every route
// to /maintenance with HTTP 503 (Google reads 503 + Retry-After as
// "temporary, do not de-index"). Set it back to false (or delete) → live.
//
// Tolerant of BOM/CRLF/whitespace/case because PowerShell's
// `"true" | vercel env add` pipeline silently mangles the value.
//
// Operator bypass: set MAINTENANCE_BYPASS_TOKEN in Vercel, visit
// /?unlock=<token> once — a 7-day cookie lets you preview the live site
// while it stays down for everyone else.
const MAINT_BYPASS_COOKIE = "prc_maint_bypass";

function maintenanceCheck(request: NextRequest): NextResponse | null {
  const raw = (process.env.MAINTENANCE_MODE ?? "")
    .replace(/^﻿/, "")
    .trim()
    .toLowerCase();
  if (raw !== "true" && raw !== "1" && raw !== "on") return null;

  const { pathname, searchParams } = request.nextUrl;

  // Allow the maintenance page itself + Next plumbing + crawler files so
  // Google can still see robots.txt / sitemap.xml correctly.
  if (
    pathname === "/maintenance" ||
    pathname.startsWith("/_next/") ||
    pathname === "/favicon.ico" ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml" ||
    pathname.startsWith("/logo/")
  ) {
    return null;
  }

  // Operator bypass: ?unlock=<token> sets a cookie, then every request from
  // this browser sees the live site for 7 days.
  const bypassToken = process.env.MAINTENANCE_BYPASS_TOKEN;
  if (bypassToken) {
    if (searchParams.get("unlock") === bypassToken) {
      const res = NextResponse.next();
      res.cookies.set(MAINT_BYPASS_COOKIE, bypassToken, {
        maxAge: 60 * 60 * 24 * 7,
        httpOnly: true,
        sameSite: "lax",
        path: "/",
      });
      return res;
    }
    if (request.cookies.get(MAINT_BYPASS_COOKIE)?.value === bypassToken) {
      return null;
    }
  }

  const url = request.nextUrl.clone();
  url.pathname = "/maintenance";
  url.search = "";
  return NextResponse.rewrite(url, {
    status: 503,
    headers: { "Retry-After": "3600" },
  });
}

export async function middleware(request: NextRequest, event: NextFetchEvent) {
  const maintResponse = maintenanceCheck(request);
  if (maintResponse) return maintResponse;

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookies) {
          cookies.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookies.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  await supabase.auth.getUser();

  // --- First-party analytics -------------------------------------------------
  trackPageview(request, response, event);

  return response;
}

/**
 * Assigns identity cookies and fires the server-side pageview. Counts document
 * loads and client-side (RSC) navigations, but skips prefetches — Next issues
 * a prefetch request for links in view, which is not a real visit.
 */
function trackPageview(
  request: NextRequest,
  response: NextResponse,
  event: NextFetchEvent,
): void {
  const isPrefetch =
    request.headers.get("next-router-prefetch") === "1" ||
    request.headers.get("purpose") === "prefetch" ||
    request.headers.get("x-purpose") === "prefetch";

  if (
    request.method !== "GET" ||
    isPrefetch ||
    !shouldTrackPath(request.nextUrl.pathname)
  ) {
    return;
  }

  // Identity cookies. Both are SET-ONLY-IF-MISSING so the response carries no
  // Set-Cookie on the cached path. The previous code re-set prc_sid on every
  // hit to "slide" the 30-min window, which forced Set-Cookie on every page
  // render and made Vercel treat the response as uncacheable. The sliding
  // behaviour is now handled in the DB row instead - /api/track bumps
  // analytics_sessions.last_seen_at on every beacon, so the session window
  // still slides even though the browser-side cookie's maxAge is fixed.
  //
  // Trade-off: a visitor who keeps a tab idle for >30 min then refreshes
  // gets a new sid (a clean new session). Previously the sliding cookie
  // would let them keep the same sid forever as long as they navigated
  // within 30 min of the last hit. The DB row still treats the visit as
  // one session via the vid match, so the sid renewal is the cleanly
  // correct semantic, not a regression.
  const secure = process.env.NODE_ENV === "production";
  let vid = request.cookies.get(VISITOR_COOKIE)?.value;
  let sid = request.cookies.get(SESSION_COOKIE)?.value;
  const writesIdentity = !vid || !sid;
  if (!vid) {
    vid = crypto.randomUUID();
    response.cookies.set(VISITOR_COOKIE, vid, {
      maxAge: VISITOR_TTL_SECONDS,
      httpOnly: true,
      sameSite: "lax",
      secure,
      path: "/",
    });
  }
  if (!sid) {
    sid = crypto.randomUUID();
    response.cookies.set(SESSION_COOKIE, sid, {
      maxAge: SESSION_TTL_SECONDS,
      httpOnly: true,
      sameSite: "lax",
      secure,
      path: "/",
    });
  }
  // Cooperative signal so the cache layer can short-circuit on returning
  // visitors. Vercel ignores `private` on the response if Set-Cookie is
  // present (which we've now eliminated for returning visitors). The
  // Cache-Control header is set further up the chain by the route; we just
  // flag this for the route to read if it wants to.
  if (!writesIdentity) {
    response.headers.set("x-prc-identity", "warm");
  }

  const url = request.nextUrl;
  const payload: Record<string, string | null> = {
    sid,
    vid,
    path: url.pathname,
    referrer: request.headers.get("referer"),
    host: request.headers.get("host") ?? url.host,
    country: request.headers.get("x-vercel-ip-country"),
    ua: request.headers.get("user-agent"),
  };
  for (const k of UTM_KEYS) payload[k] = url.searchParams.get(k);

  const secret = process.env.ANALYTICS_TRACK_SECRET;
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };
  if (secret) headers["x-track-secret"] = secret;

  // Fire-and-forget, server-to-server. waitUntil keeps the function alive until
  // the POST resolves without delaying the user's response.
  event.waitUntil(
    fetch(`${url.origin}/api/track`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => {
      // Best-effort: a dropped beacon must never affect page delivery.
    }),
  );
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     * - images / videos / fonts
     * - api/webhooks/* (external services like Shiprocket/Razorpay — must respond
     *   fast and never need a Supabase session refresh)
     */
    "/((?!_next/static|_next/image|favicon.ico|api/webhooks|.*\\.(?:svg|png|jpg|jpeg|gif|webp|mp4|woff2|ttf)$).*)",
  ],
};
