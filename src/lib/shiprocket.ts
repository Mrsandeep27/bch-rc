import { logError } from "@/lib/logger";

/**
 * Shiprocket helper — token cache + order/shipment creation + AWB assignment.
 *
 * Auth: Shiprocket issues a JWT that's valid for ~10 days. We cache it in
 * memory with a 9-day TTL. Each Vercel cold start refreshes (fine for our
 * volume). For higher scale, move the cache to Upstash Redis.
 *
 * Order creation pattern:
 *  1. POST /v1/external/orders/create/adhoc — creates a logical order
 *     Returns: { order_id (theirs), shipment_id, status }
 *  2. POST /v1/external/courier/assign/awb { shipment_id } — assigns courier
 *     Returns: { awb_code, courier_name, tracking_url }
 *
 * We bundle both in `createShipment()` so callers get the final AWB.
 */

const API = "https://apiv2.shiprocket.in/v1/external";

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.token;
  }
  const email = process.env.SHIPROCKET_EMAIL;
  const password = process.env.SHIPROCKET_PASSWORD;
  if (!email || !password) {
    throw new Error("SHIPROCKET_EMAIL and SHIPROCKET_PASSWORD must be set");
  }

  const res = await fetch(`${API}/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Shiprocket auth failed: ${res.status} ${body}`);
  }

  const data = (await res.json()) as { token: string };
  cachedToken = {
    token: data.token,
    // Refresh after 9 days (token TTL is 10 days)
    expiresAt: Date.now() + 9 * 24 * 60 * 60 * 1000,
  };
  return data.token;
}

async function srFetch<T>(
  path: string,
  init: RequestInit & { method: "GET" | "POST" | "PATCH" | "DELETE" },
): Promise<T> {
  const token = await getToken();
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      ...init.headers,
      "content-type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Shiprocket ${init.method} ${path} → ${res.status}: ${text}`);
  }
  return JSON.parse(text) as T;
}

// ============================================================
// Serviceability — live courier lookup
// ============================================================

/**
 * Shape returned by Shiprocket's GET /courier/serviceability/.
 * Only the fields we actually read are typed; the rest is `unknown`.
 */
type ServiceabilityResp = {
  status: number;
  data?: {
    available_courier_companies?: Array<{
      courier_company_id: number;
      courier_name?: string;
      cod: number; // 0 or 1
      estimated_delivery_days?: string | number;
      etd?: string;
    }>;
    recommended_courier_company_id?: number;
  };
};

export type ShiprocketServiceability = {
  /** At least one courier covers this pickup→delivery route. */
  serviceable: boolean;
  /** At least one courier covers it AND supports COD. */
  codAvailable: boolean;
  /** Min ETA across available couriers, in business days. null if unknown. */
  etaMinDays: number | null;
  /** Max ETA across available couriers, in business days. null if unknown. */
  etaMaxDays: number | null;
};

/**
 * Live serviceability check against Shiprocket. Returns null on API failure
 * so callers can fall back to a deterministic heuristic — we never want a
 * Shiprocket outage to break checkout for everyone.
 *
 * NOTE: weight = 0.5 kg (one car + box). Adjust if cart-size logic moves
 * the package weight beyond what a single courier slab covers.
 */
export async function getShiprocketServiceability(
  deliveryPincode: string,
  needsCod: boolean,
): Promise<ShiprocketServiceability | null> {
  if (!/^[1-9][0-9]{5}$/.test(deliveryPincode)) return null;

  const pickupPincode = process.env.SHIPROCKET_PICKUP_PINCODE ?? "560064";
  const url =
    `${API}/courier/serviceability/` +
    `?pickup_postcode=${pickupPincode}` +
    `&delivery_postcode=${deliveryPincode}` +
    `&cod=${needsCod ? 1 : 0}` +
    `&weight=0.5`;

  try {
    const token = await getToken();
    const res = await fetch(url, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
      // Tight timeout — the checkout form blocks on this; better to fall
      // back to the heuristic than make the buyer wait.
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) {
      logError("shiprocket:serviceability", new Error(`${res.status} ${await res.text()}`));
      return null;
    }
    const json = (await res.json()) as ServiceabilityResp;
    const couriers = json.data?.available_courier_companies ?? [];
    if (couriers.length === 0) {
      // Shiprocket genuinely doesn't serve this PIN — fail closed.
      return { serviceable: false, codAvailable: false, etaMinDays: null, etaMaxDays: null };
    }
    const codCouriers = couriers.filter((c) => c.cod === 1);
    const etas = couriers
      .map((c) => Number(c.estimated_delivery_days))
      .filter((n) => Number.isFinite(n) && n > 0);
    return {
      serviceable: true,
      codAvailable: codCouriers.length > 0,
      etaMinDays: etas.length ? Math.min(...etas) : null,
      etaMaxDays: etas.length ? Math.max(...etas) : null,
    };
  } catch (err) {
    logError("shiprocket:serviceability", err);
    return null;
  }
}

// ============================================================
// Types
// ============================================================

export type ShiprocketItem = {
  name: string;
  sku: string;
  units: number;
  selling_price: number;
  discount?: number;
  tax?: number;
  hsn?: string;
};

export type CreateShipmentInput = {
  /** Our order ID (PRC-XXXXXXXX). Shiprocket calls this `order_id`. */
  orderId: string;
  orderPlacedAt: Date;
  customer: {
    name: string;
    phone: string;
    email?: string | null;
    line1: string;
    line2?: string | null;
    city: string;
    state: string;
    pincode: string;
  };
  items: ShiprocketItem[];
  subtotalInr: number;
  paymentMethod: "Prepaid" | "COD";
  /** Box dimensions in cm + weight in kg. Defaults to small RC car parcel. */
  dimensions?: { lengthCm: number; breadthCm: number; heightCm: number; weightKg: number };
};

export type ShiprocketOrderResponse = {
  order_id: number; // their internal id
  shipment_id: number;
  status: string;
  status_code: number;
  onboarding_completed_now: number;
  awb_code: string | null;
  courier_company_id: number | null;
  courier_name: string | null;
};

export type AssignAwbResponse = {
  awb_assign_status: number;
  response: {
    data: {
      courier_company_id: number;
      awb_code: string;
      courier_name: string;
      assigned_date_time: { date: string };
    };
  };
};

// ============================================================
// Public helpers
// ============================================================

/**
 * Two-step shipment creation: create order, then assign an AWB courier.
 * Returns the final shipment metadata we save to our orders row.
 */
export async function createShipment(input: CreateShipmentInput): Promise<{
  shiprocketOrderId: string;
  shipmentId: string;
  awbCode: string | null;
  courierName: string | null;
  trackingUrl: string | null;
}> {
  const pickup = process.env.SHIPROCKET_PICKUP_LOCATION;
  if (!pickup) throw new Error("SHIPROCKET_PICKUP_LOCATION not set");

  const dims = input.dimensions ?? {
    lengthCm: 20,
    breadthCm: 15,
    heightCm: 10,
    weightKg: 0.4,
  };

  const nameParts = input.customer.name.trim().split(/\s+/);
  const firstName = nameParts[0] ?? input.customer.name;
  const lastName = nameParts.slice(1).join(" ") || ".";

  const body = {
    order_id: input.orderId,
    order_date: input.orderPlacedAt.toISOString().slice(0, 19).replace("T", " "),
    pickup_location: pickup,
    channel_id: "",
    comment: "",
    billing_customer_name: firstName,
    billing_last_name: lastName,
    billing_address: input.customer.line1,
    billing_address_2: input.customer.line2 ?? "",
    billing_city: input.customer.city,
    billing_pincode: input.customer.pincode,
    billing_state: input.customer.state,
    billing_country: "India",
    billing_email: input.customer.email ?? "noreply@pocketrccars.com",
    billing_phone: input.customer.phone,
    shipping_is_billing: true,
    order_items: input.items,
    payment_method: input.paymentMethod,
    sub_total: input.subtotalInr,
    length: dims.lengthCm,
    breadth: dims.breadthCm,
    height: dims.heightCm,
    weight: dims.weightKg,
  };

  const order = await srFetch<ShiprocketOrderResponse>(
    "/orders/create/adhoc",
    { method: "POST", body: JSON.stringify(body) },
  );

  // If AWB wasn't auto-assigned (most cases), call assign AWB.
  let awbCode = order.awb_code;
  let courierName = order.courier_name;

  if (!awbCode && order.shipment_id) {
    try {
      const awbResp = await srFetch<AssignAwbResponse>(
        "/courier/assign/awb",
        {
          method: "POST",
          body: JSON.stringify({ shipment_id: order.shipment_id }),
        },
      );
      awbCode = awbResp.response?.data?.awb_code ?? null;
      courierName = awbResp.response?.data?.courier_name ?? null;
    } catch (err) {
      // Order is still created on Shiprocket's side; admin can retry AWB
      // assignment manually. Use the typed logger so the raw err object
      // (which may echo back our auth token in its response body) never
      // reaches Vercel logs.
      logError("shiprocket:awb-assign", err, {
        shipmentId: String(order.shipment_id ?? ""),
      });
    }
  }

  return {
    shiprocketOrderId: String(order.order_id),
    shipmentId: String(order.shipment_id),
    awbCode,
    courierName,
    trackingUrl: awbCode
      ? `https://shiprocket.co/tracking/${awbCode}`
      : null,
  };
}

/**
 * Cancel an order on Shiprocket's side. Used when our DB rolls a "phantom
 * paid" order back to FAILED — leaving the Shiprocket order alive would risk
 * an actual pickup against goods we were never paid for.
 *
 * The cancel API takes the Shiprocket numeric order id (NOT our PRC-XXX),
 * because Shiprocket only indexes their own id post-creation.
 */
export async function cancelShiprocketOrder(
  shiprocketOrderId: string,
): Promise<{ ok: boolean; message: string }> {
  try {
    const data = await srFetch<{ message?: string; status_code?: number }>(
      "/orders/cancel",
      {
        method: "POST",
        body: JSON.stringify({ ids: [Number(shiprocketOrderId)] }),
      },
    );
    return { ok: true, message: data.message ?? "cancelled" };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Status pings (used by manual refresh or admin override).
 */
export async function getShipmentStatus(shipmentId: string): Promise<{
  current_status: string;
  current_status_id: number;
  awb: string | null;
}> {
  const data = await srFetch<{
    tracking_data: {
      shipment_track: Array<{
        current_status: string;
        current_status_id: number;
        awb_code: string | null;
      }>;
    };
  }>(`/courier/track/shipment/${shipmentId}`, { method: "GET" });

  const t = data.tracking_data?.shipment_track?.[0];
  return {
    current_status: t?.current_status ?? "Unknown",
    current_status_id: t?.current_status_id ?? 0,
    awb: t?.awb_code ?? null,
  };
}

/**
 * Maps Shiprocket's status text to our order_status enum.
 * Reference: Shiprocket status codes 1-19+ for various states.
 */
export function mapShiprocketStatus(
  status: string,
): "PACKED" | "SHIPPED" | "DELIVERED" | "RETURNED" | "CANCELLED" | null {
  const s = status.toUpperCase();
  if (s.includes("DELIVERED")) return "DELIVERED";
  if (s.includes("RTO") || s.includes("RETURNED")) return "RETURNED";
  if (s.includes("CANCELLED") || s.includes("CANCELED")) return "CANCELLED";
  if (
    s.includes("OUT FOR DELIVERY") ||
    s.includes("SHIPPED") ||
    s.includes("IN TRANSIT") ||
    s.includes("PICKED UP")
  ) {
    return "SHIPPED";
  }
  if (s.includes("PICKUP SCHEDULED") || s.includes("READY TO SHIP")) {
    return "PACKED";
  }
  return null;
}
