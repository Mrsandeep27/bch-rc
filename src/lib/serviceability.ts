/**
 * Pincode serviceability + delivery ETA — single source of truth shared by:
 *   - the checkout UI (live check as the customer types the pincode)
 *   - /api/serviceability (the route the UI calls)
 *   - /api/orders/create (the HARD server-side gate that blocks orders we
 *     can't actually fulfil, so the customer never gets a surprise cancellation)
 *
 * This is a deterministic heuristic, not a live courier call — same pincode
 * always yields the same answer (no flicker, no per-request cost). When the
 * Shiprocket serviceability API is wired in, swap the body of
 * `resolveServiceability` and keep this signature so every call site keeps
 * working.
 */

// Metro prefixes (first 2 digits) — 2-3 day delivery. Everything else 3-5.
const METRO_PREFIXES = new Set([
  "11", // Delhi
  "12",
  "20", // Lucknow
  "30", // Jaipur
  "38", // Ahmedabad
  "40", // Mumbai
  "41", // Pune
  "44", // Chennai outer
  "50", // Hyderabad
  "56", // Bangalore
  "60", // Chennai
  "70", // Kolkata
]);

// Remote / hard-to-reach circles where COD is unreliable (RTO risk) — prepaid
// only. First 2 digits of the pincode. Tune from real RTO data over time.
const COD_BLOCKED_PREFIXES = new Set([
  "19", // J&K / Ladakh
  "79", // Arunachal / NE far
  "73", // parts of Sikkim/NE
]);

// Circles we genuinely don't ship to yet. Empty for now (pan-India), but the
// seam exists so ops can switch one off without a code change of substance.
const NON_SERVICEABLE_PREFIXES = new Set<string>([]);

export type Serviceability = {
  /** The pincode echoed back (normalised). */
  pincode: string;
  /** Valid 6-digit Indian pincode that isn't in a non-serviceable circle. */
  serviceable: boolean;
  /** COD allowed for this pincode (serviceable AND not in the COD blocklist). */
  codAvailable: boolean;
  /** Min / max business-day delivery estimate. */
  etaMinDays: number;
  etaMaxDays: number;
  /** Human delivery date range, e.g. "Wed, 04 Jun". */
  etaText: string;
  /** Customer-facing reason when not serviceable / COD blocked. */
  reason: string | null;
};

const PINCODE_RE = /^[1-9][0-9]{5}$/; // Indian pincodes never start with 0

function deliveryDate(fromDays: number, now: Date): string {
  const dt = new Date(now);
  dt.setDate(dt.getDate() + fromDays);
  return dt.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

/**
 * @param now injectable for deterministic tests; defaults to current time.
 */
export function resolveServiceability(
  rawPincode: string,
  now: Date = new Date(),
): Serviceability {
  const pincode = (rawPincode ?? "").trim();
  const prefix = pincode.slice(0, 2);

  const base: Serviceability = {
    pincode,
    serviceable: false,
    codAvailable: false,
    etaMinDays: 0,
    etaMaxDays: 0,
    etaText: "",
    reason: null,
  };

  if (!PINCODE_RE.test(pincode)) {
    return { ...base, reason: "Enter a valid 6-digit pincode." };
  }
  if (NON_SERVICEABLE_PREFIXES.has(prefix)) {
    return {
      ...base,
      reason: "We don't deliver to this pincode yet. WhatsApp us to check.",
    };
  }

  const isMetro = METRO_PREFIXES.has(prefix);
  // Seed off the last 2 digits so adjacent pincodes get slightly different
  // ETAs (feels real, not algorithmic).
  const seed = parseInt(pincode.slice(-2), 10) || 0;
  const etaMinDays = isMetro ? 2 : 3;
  const etaMaxDays = isMetro ? 2 + (seed % 2) + 1 : 3 + (seed % 3) + 1; // metro 2-3, other 3-5
  const codAvailable = !COD_BLOCKED_PREFIXES.has(prefix);

  return {
    pincode,
    serviceable: true,
    codAvailable,
    etaMinDays,
    etaMaxDays,
    etaText: `${deliveryDate(etaMinDays, now)}–${deliveryDate(etaMaxDays, now)}`,
    reason: codAvailable
      ? null
      : "COD isn't available for this pincode — pay online to order (you save ₹100).",
  };
}
