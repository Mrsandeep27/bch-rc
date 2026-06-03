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

  // Address composition:
  //   line1 = house no + road  (the "street" the courier needs)
  //   line2 = locality / area  (neighbourhood, suburb, city-district)
  // We deliberately DON'T use `amenity`/`shop` as a building — those are the
  // nearest POI Nominatim could find (a temple, ATM, restaurant), NOT the
  // buyer's address. Falsely seeding the form with a landmark misleads the
  // courier and gives buyers a bad first impression. We only honour `building`
  // (a tagged structure name) when it's present.
  const street = [a.house_number, a.road || a.pedestrian || a.residential]
    .filter(Boolean)
    .join(" ");
  const locality =
    a.neighbourhood || a.quarter || a.suburb || a.city_district || a.borough || "";
  const building = a.building || "";

  let line1 = [building, street].filter(Boolean).join(", ");
  let line2 = locality;

  // GPS in India rarely returns a house number, so line1 is often empty even
  // when locality is fine. Promote locality → line1 so the required field is
  // populated; the buyer can then add their flat/building on line2.
  if (!line1 && line2) {
    line1 = line2;
    line2 = "";
  }

  // Last-resort fallback: slice `display_name` (always present, most detailed)
  // and drop trailing parts that already populate other fields.
  if (!line1 && data.display_name) {
    const parts = data.display_name.split(",").map((s) => s.trim());
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
    // Put first piece on line1, next two on line2 — keeps line1 short.
    line1 = head[0] || "";
    line2 = head.slice(1, 3).join(", ");
  }

  return NextResponse.json({
    ok: true,
    pincode: a.postcode || "",
    city,
    state,
    line1,
    line2,
    country: a.country || "",
    countryCode: (a.country_code || "").toUpperCase(),
    displayName: data.display_name || "",
  });
}
