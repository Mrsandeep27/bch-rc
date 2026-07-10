/**
 * TEMPORARY debug endpoint — /api/test-shiprocket
 *
 * Sole purpose: determine whether Shiprocket's servers can reach THIS site at
 * all, with every possible obstacle removed:
 *   - no auth / token check
 *   - no database
 *   - no environment variables
 *   - no body validation (reads the body only to log it)
 *   - excluded from middleware (see the matcher in middleware.ts)
 *
 * Diagnostic logic:
 *   - Shiprocket reaches THIS but not /api/webhooks/courier → the difference is
 *     in the webhook route (auth/DB/parsing) — investigate there.
 *   - Shiprocket reaches NEITHER → the failure is network/DNS/TLS between
 *     Shiprocket and the domain, not our code.
 *
 * Always answers HTTP 200 to GET / POST / OPTIONS. DELETE once the real webhook
 * is confirmed working.
 */

import { NextResponse } from "next/server";

// Node runtime, always dynamic — never cache a probe response.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,OPTIONS",
  "access-control-allow-headers": "*",
};

function payload() {
  return {
    status: "alive",
    source: "shiprocket-test",
    time: new Date().toISOString(),
  };
}

function logRequest(method: string, req: Request, body?: string): void {
  const headers: Record<string, string> = {};
  req.headers.forEach((value, key) => {
    headers[key] = value;
  });
  // Single structured line so it's greppable in `vercel logs`.
  console.log(
    `[test-shiprocket] ${method} ` +
      JSON.stringify({ method, headers, body: body ?? null }),
  );
}

export async function GET(req: Request) {
  logRequest("GET", req);
  return NextResponse.json(payload(), { headers: CORS });
}

export async function POST(req: Request) {
  let body = "";
  try {
    body = await req.text();
  } catch {
    // No validation — an unreadable body is fine, we still answer 200.
  }
  logRequest("POST", req, body);
  return NextResponse.json(payload(), { headers: CORS });
}

export async function OPTIONS(req: Request) {
  logRequest("OPTIONS", req);
  // Some webhook validators send a CORS preflight; answer 200 (not 204) with
  // the same body so "always 200 + JSON" holds for every method.
  return NextResponse.json(payload(), { headers: CORS });
}
