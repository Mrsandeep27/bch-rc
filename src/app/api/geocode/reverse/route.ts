/**
 * GET /api/geocode/reverse?lat=12.9716&lon=77.5946
 *
 * Reverse-geocode lat/lng → Indian address parts (pincode, city, state, line1).
 * Used by the checkout page's "Use my current location" button so buyers
 * don't have to type their full address — Swiggy / Zomato style.
 *
 * Provider: OpenStreetMap Nominatim. Free, no API key, ~1 req/sec rate limit
 * per their fair-use policy. We send a proper User-Agent so they can throttle
 * us by app rather than by IP if we exceed.
 *
 * To upgrade later (Mappls / Google), swap the provider call below — the
 * response shape this endpoint returns is provider-agnostic.
 */

import { NextResponse } from "next/server";

type NominatimAddress = {
  postcode?: string;
  house_number?: string;
  building?: string;
  amenity?: string;
  shop?: string;
  road?: string;
  pedestrian?: string;
  residential?: string;
  neighbourhood?: string;
  quarter?: string;
  suburb?: string;
  city_district?: string;
  borough?: string;
  city?: string;
  town?: string;
  village?: string;
  county?: string;
  state?: string;
  country?: string;
  country_code?: string;
};

type NominatimResponse = {
  display_name?: string;
  address?: NominatimAddress;
  error?: string;
};

export async function GET(req: Request) {
  const url = new URL(req.url);
  const lat = url.searchParams.get("lat");
  const lon = url.searchParams.get("lon");

  if (!lat || !lon || isNaN(Number(lat)) || isNaN(Number(lon))) {
    return NextResponse.json(
      { error: "lat and lon query params required (decimal numbers)" },
      { status: 400 },
    );
  }

  const upstream = new URL("https://nominatim.openstreetmap.org/reverse");
  upstream.searchParams.set("lat", lat);
  upstream.searchParams.set("lon", lon);
  upstream.searchParams.set("format", "json");
  upstream.searchParams.set("addressdetails", "1");
  upstream.searchParams.set("zoom", "18"); // street-level

  let data: NominatimResponse;
  try {
    const r = await fetch(upstream.toString(), {
      headers: {
        // Nominatim's policy requires a UA identifying the app + a contact.
        "User-Agent": "PRCCars-Checkout/1.0 (hello@pocketrccars.com)",
        Accept: "application/json",
      },
      // Nominatim is slow under load; don't hold the function forever.
      signal: AbortSignal.timeout(6000),
    });
    if (!r.ok) {
      return NextResponse.json(
        { error: `geocode upstream ${r.status}` },
        { status: 502 },
      );
    }
    data = (await r.json()) as NominatimResponse;
  } catch (err) {
    return NextResponse.json(
      { error: `geocode failed: ${String(err)}` },
      { status: 502 },
    );
  }

  if (data.error || !data.address) {
    return NextResponse.json(
      { error: data.error || "no address found for these coords" },
      { status: 404 },
    );
  }

  const a = data.address;

  // City: try city → town → village → county (rural fallback)
  const city = a.city || a.town || a.village || a.county || "";
  const state = a.state || "";

  // Line 1 — pack as much specific detail as Nominatim returned, in the order
  // a courier reads: building → house no + road → locality → sub-city.
  // Indian Nominatim data is patchy, so we fall back to slicing `display_name`
  // (which Nominatim ALWAYS returns and is the most detailed string they have)
  // and trimming off the trailing parts that already populate other fields
  // (city / state / postcode / country).
  const street = [a.house_number, a.road || a.pedestrian || a.residential]
    .filter(Boolean)
    .join(" ");
  const locality =
    a.neighbourhood || a.quarter || a.suburb || a.city_district || a.borough || "";
  const building = a.building || a.amenity || a.shop || "";

  const line1Pieces = [building, street, locality].filter(Boolean);
  let line1 = line1Pieces.join(", ");

  // If we still got nothing useful, fall back to the head of `display_name`
  // up to (but not including) the city. e.g. "Plot 12, MIDC, Andheri East"
  // out of "Plot 12, MIDC, Andheri East, Mumbai Suburban, Maharashtra, 400096, India".
  if (!line1 && data.display_name) {
    const parts = data.display_name.split(",").map((s) => s.trim());
    // Drop trailing pieces that match what we already returned separately.
    const tail = new Set(
      [city, state, a.postcode, a.country, a.county]
        .filter(Boolean)
        .map((s) => (s as string).toLowerCase()),
    );
    const head: string[] = [];
    for (const p of parts) {
      if (tail.has(p.toLowerCase())) break;
      head.push(p);
    }
    // Cap at first 3 pieces so we don't dump the entire string into one field.
    line1 = head.slice(0, 3).join(", ");
  }

  return NextResponse.json({
    ok: true,
    pincode: a.postcode || "",
    city,
    state,
    line1,
    country: a.country || "",
    countryCode: (a.country_code || "").toUpperCase(),
    displayName: data.display_name || "",
  });
}
