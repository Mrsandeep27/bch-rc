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

export async function middleware(request: NextRequest, event: NextFetchEvent) {
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

  // Identity cookies. visitor = stable 1y; session = 30-min sliding (re-set on
  // every tracked hit so it slides while active and lapses after 30 min idle).
  const secure = process.env.NODE_ENV === "production";
  let vid = request.cookies.get(VISITOR_COOKIE)?.value;
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

  let sid = request.cookies.get(SESSION_COOKIE)?.value;
  if (!sid) sid = crypto.randomUUID();
  response.cookies.set(SESSION_COOKIE, sid, {
    maxAge: SESSION_TTL_SECONDS,
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
  });

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
