/**
 * GET /api/geocode/pincode?pincode=400093
 *
 * Looks up an Indian pincode against India Post's free public API and returns
 * `{ city, state, areas[] }` for the front-end to auto-fill the checkout form.
 *
 * Why this exists in addition to /api/geocode/reverse:
 * On desktop browsers `navigator.geolocation` falls back to IP geolocation
 * which can be off by 5-50 km. Buyers ended up with the wrong pincode +
 * locality and had to retype everything. Pincode-driven autofill is the
 * pattern Flipkart / Amazon / Swiggy use on desktop — type the postcode you
 * already know, and the city/state populate themselves.
 *
 * Provider: api.postalpincode.in. Free, no API key, ~maintained by community,
 * very reliable for Indian pincodes (it wraps India Post's official data).
 *
 * Response shape (front-end contract):
 *   { ok: true, city, state, areas: string[] }   on hit
 *   { ok: false, error }                          on 404 / upstream error
 */

import { NextResponse } from "next/server";

type PostalApiPostOffice = {
  Name?: string;
  District?: string;
  State?: string;
  Block?: string;
  Country?: string;
  Pincode?: string;
};

type PostalApiResponse = {
  Status?: "Success" | "Error" | "404";
  Message?: string;
  PostOffice?: PostalApiPostOffice[] | null;
}[];

export async function GET(req: Request) {
  const url = new URL(req.url);
  const pincode = (url.searchParams.get("pincode") ?? "").trim();

  if (!/^\d{6}$/.test(pincode)) {
    return NextResponse.json(
      { ok: false, error: "pincode must be 6 digits" },
      { status: 400 },
    );
  }

  let data: PostalApiResponse;
  try {
    const r = await fetch(
      `https://api.postalpincode.in/pincode/${pincode}`,
      {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(5000),
        // Cache 24h at the edge — pincode → city/state never changes.
        next: { revalidate: 86400 },
      },
    );
    if (!r.ok) {
      return NextResponse.json(
        { ok: false, error: `upstream ${r.status}` },
        { status: 502 },
      );
    }
    data = (await r.json()) as PostalApiResponse;
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: `pincode lookup failed: ${String(err)}` },
      { status: 502 },
    );
  }

  const first = data?.[0];
  if (!first || first.Status !== "Success" || !first.PostOffice?.length) {
    return NextResponse.json(
      { ok: false, error: "Pincode not found" },
      { status: 404 },
    );
  }

  // Multiple post offices share a pincode — they all belong to the same
  // district/state. Take the first for city/state and surface every name as
  // a suggested locality the buyer can pick (or auto-fill the first one).
  const po = first.PostOffice[0];
  const city = po.District || "";
  const state = po.State || "";
  const areas = Array.from(
    new Set(
      first.PostOffice.map((p) => p.Name).filter(
        (n): n is string => typeof n === "string" && n.length > 0,
      ),
    ),
  );

  return NextResponse.json({ ok: true, city, state, areas });
}
