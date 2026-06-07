import { NextRequest, NextResponse } from "next/server";

/**
 * MAINTENANCE MODE
 *
 * When `MAINTENANCE_MODE=true` is set in the Vercel environment, every
 * request is rewritten to /maintenance with HTTP 503 (so Google does NOT
 * de-index pages — 503 tells crawlers "temporarily unavailable, come back").
 *
 * To take the site down:
 *   1. Vercel dashboard → Project → Settings → Environment Variables
 *   2. Add: MAINTENANCE_MODE = true
 *   3. Click "Save" — Vercel auto-redeploys in ~30s
 *
 * To bring the site back up:
 *   1. Same place → delete (or set to false) MAINTENANCE_MODE
 *   2. Save → site live again in ~30s
 *
 * BYPASS for the operator (so YOU can still preview while the site is down
 * to everyone else):
 *   Set MAINTENANCE_BYPASS_TOKEN to a random string in Vercel.
 *   Visit https://pocketrccars.com/?unlock=<that-string> — sets a cookie,
 *   you see the live site for 7 days.
 *
 * The /maintenance page, Next.js static assets, robots.txt, sitemap.xml,
 * and favicons are always allowed (so Google can re-crawl correctly).
 */

const BYPASS_COOKIE = "prc_maint_bypass";

export function middleware(req: NextRequest) {
  // Tolerate BOM/CRLF/whitespace that PowerShell's `"true" | vercel env add`
  // pipeline silently adds. process.env.MAINTENANCE_MODE === "true" is a
  // fragile equality on Windows hosts; trim + strip BOM first.
  const maintRaw = (process.env.MAINTENANCE_MODE ?? "")
    .replace(/^﻿/, "")
    .trim()
    .toLowerCase();
  if (maintRaw !== "true" && maintRaw !== "1" && maintRaw !== "on") {
    return NextResponse.next();
  }

  const { pathname, searchParams } = req.nextUrl;

  // Always allow the maintenance page itself + Next.js plumbing + crawler
  // files. Without this Google sees 503 on robots.txt and may misread it.
  if (
    pathname === "/maintenance" ||
    pathname.startsWith("/_next/") ||
    pathname === "/favicon.ico" ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml" ||
    pathname.startsWith("/logo/")
  ) {
    return NextResponse.next();
  }

  // Operator bypass — visit /?unlock=<MAINTENANCE_BYPASS_TOKEN> once, then
  // every subsequent visit on this browser sees the live site.
  const bypassToken = process.env.MAINTENANCE_BYPASS_TOKEN;
  const unlock = searchParams.get("unlock");
  if (bypassToken && unlock === bypassToken) {
    const res = NextResponse.next();
    res.cookies.set(BYPASS_COOKIE, bypassToken, {
      maxAge: 60 * 60 * 24 * 7, // 7 days
      httpOnly: true,
      sameSite: "lax",
      path: "/",
    });
    return res;
  }
  if (
    bypassToken &&
    req.cookies.get(BYPASS_COOKIE)?.value === bypassToken
  ) {
    return NextResponse.next();
  }

  // Everyone else → rewrite to /maintenance with 503 status. 503 +
  // Retry-After tells Google "temporary, come back later" so no de-indexing
  // happens; once MAINTENANCE_MODE flips off, listings come back unchanged.
  const url = req.nextUrl.clone();
  url.pathname = "/maintenance";
  url.search = "";
  return NextResponse.rewrite(url, {
    status: 503,
    headers: { "Retry-After": "3600" },
  });
}

// Run on every route EXCEPT static asset paths that don't need gating.
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|mp4|webm|woff|woff2|ttf|otf)$).*)",
  ],
};
