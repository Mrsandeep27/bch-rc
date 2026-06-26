/**
 * GST tax-invoice computation for PRC orders.
 *
 * Storefront prices are GST-INCLUSIVE (policies.ts: "All prices are in INR
 * and inclusive of GST"). So the invoice back-calculates the taxable value
 * and tax from the amount actually charged — never adds tax on top.
 *
 * Place-of-supply logic (boAt / standard Indian D2C):
 *   • Delivery state == seller state (Karnataka, code 29) → intra-state →
 *     split tax into CGST + SGST (each half the rate).
 *   • Delivery state != seller state → inter-state → single IGST (full rate).
 *
 * The grand total ALWAYS reconciles to order.totalInr so the invoice can
 * never disagree with what the customer paid / owes.
 */

import { THEME } from "@/lib/theme";
import { formatIST } from "@/lib/utils";

export type InvoiceLine = {
  description: string;
  /** Product thumbnail (order snapshot image), or null. */
  image: string | null;
  /** "skuId · variant" reference, or null. */
  sku: string | null;
  hsn: string;
  qty: number;
  /** GST-inclusive unit price (what the customer saw). */
  unitInclInr: number;
  /** GST-inclusive line total = unitInclInr * qty. */
  lineInclInr: number;
};

export type InvoiceOrderItem = {
  name: string;
  qty: number;
  unitPriceInr?: number;
  lineTotalInr?: number;
  image?: string | null;
  skuId?: string;
  variantSlug?: string | null;
};

export type InvoiceInput = {
  id: string;
  /** GST invoice number from Zoho Books. Null until an operator enters it. */
  invoiceNumber: string | null;
  placedAt: Date;
  items: InvoiceOrderItem[];
  subtotalInr: number;
  shippingInr: number;
  discountInr: number;
  codFeeInr: number;
  confirmationFeeInr: number;
  totalInr: number;
  paymentMethod: string;
  shippingAddress: {
    fullName?: string;
    phone?: string;
    line1?: string;
    line2?: string | null;
    city?: string;
    state?: string;
    pincode?: string;
    email?: string;
  };
};

export type ComputedInvoice = {
  /** Zoho invoice number, or null if not yet assigned (DRAFT state). */
  invoiceNumber: string | null;
  /** True when no Zoho number is set — invoice must not go to a customer. */
  isDraft: boolean;
  invoiceDate: string;
  orderId: string;
  lines: InvoiceLine[];
  isIntraState: boolean;
  placeOfSupply: string;
  /** Net GST-inclusive amount the tax is derived from (== totalInr). */
  grandTotalInr: number;
  taxableValueInr: number;
  totalTaxInr: number;
  cgstInr: number;
  sgstInr: number;
  igstInr: number;
  gstRatePct: number;
  hsn: string;
  amountInWords: string;
  /** Partial-prepaid COD split (0 when not applicable). */
  paidOnlineInr: number;
  dueOnDeliveryInr: number;
  seller: typeof THEME.legal;
};

/** Round to whole rupees (invoices are shown in ₹, no paise). */
function r(n: number): number {
  return Math.round(n);
}

/**
 * Back-calculate the taxable value from a GST-inclusive amount.
 * taxable = incl * 100 / (100 + rate); tax = incl - taxable.
 */
function splitInclusive(inclInr: number, ratePct: number): {
  taxable: number;
  tax: number;
} {
  const taxable = r((inclInr * 100) / (100 + ratePct));
  return { taxable, tax: r(inclInr) - taxable };
}

const ONES = [
  "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
  "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
  "Seventeen", "Eighteen", "Nineteen",
];
const TENS = [
  "", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty",
  "Ninety",
];

function twoDigits(n: number): string {
  if (n < 20) return ONES[n];
  const t = Math.floor(n / 10);
  const o = n % 10;
  return TENS[t] + (o ? " " + ONES[o] : "");
}

/** Indian-numbering amount-in-words (lakh/crore), rupees only. */
export function rupeesInWords(amount: number): string {
  let n = Math.round(amount);
  if (n === 0) return "Rupees Zero Only";
  const parts: string[] = [];

  const crore = Math.floor(n / 10000000);
  n %= 10000000;
  const lakh = Math.floor(n / 100000);
  n %= 100000;
  const thousand = Math.floor(n / 1000);
  n %= 1000;
  const hundred = Math.floor(n / 100);
  const rest = n % 100;

  if (crore) parts.push(`${twoDigits(crore)} Crore`);
  if (lakh) parts.push(`${twoDigits(lakh)} Lakh`);
  if (thousand) parts.push(`${twoDigits(thousand)} Thousand`);
  if (hundred) parts.push(`${ONES[hundred]} Hundred`);
  if (rest) parts.push(twoDigits(rest));

  return `Rupees ${parts.join(" ")} Only`;
}

export function computeInvoice(order: InvoiceInput): ComputedInvoice {
  const seller = THEME.legal;
  const gstRatePct = seller.gstRatePct;
  const hsn = seller.hsnCode;

  // Product lines — GST-inclusive, straight from the order snapshot.
  const lines: InvoiceLine[] = order.items.map((it) => {
    const lineIncl =
      it.lineTotalInr ?? (it.unitPriceInr ?? 0) * it.qty;
    const unitIncl = it.unitPriceInr ?? r(lineIncl / Math.max(1, it.qty));
    const sku = it.skuId
      ? it.variantSlug
        ? `${it.skuId} · ${it.variantSlug}`
        : it.skuId
      : null;
    return {
      description: it.name,
      image: it.image ?? null,
      sku,
      hsn,
      qty: it.qty,
      unitInclInr: r(unitIncl),
      lineInclInr: r(lineIncl),
    };
  });

  // Place of supply: compare delivery state to the seller's Karnataka.
  const deliveryState = (order.shippingAddress.state ?? "").trim().toLowerCase();
  const isIntraState =
    deliveryState.includes("karnataka") ||
    deliveryState === seller.stateCode ||
    deliveryState === "";

  // Tax is back-calculated on the FINAL inclusive amount charged (totalInr),
  // so the grand total always reconciles regardless of discounts / shipping.
  const grandTotalInr = r(order.totalInr);
  const { taxable, tax } = splitInclusive(grandTotalInr, gstRatePct);

  const cgstInr = isIntraState ? r(tax / 2) : 0;
  const sgstInr = isIntraState ? tax - cgstInr : 0; // absorb rounding remainder
  const igstInr = isIntraState ? 0 : tax;

  const paidOnlineInr =
    order.paymentMethod === "COD" ? r(order.confirmationFeeInr) : grandTotalInr;
  const dueOnDeliveryInr =
    order.paymentMethod === "COD"
      ? grandTotalInr - r(order.confirmationFeeInr)
      : 0;

  return {
    // Zoho Books is the source of truth for the GST invoice number. We never
    // mint our own — the order ID is the reference id, this is the tax-doc id.
    invoiceNumber: order.invoiceNumber,
    isDraft: !order.invoiceNumber,
    invoiceDate: formatIST(order.placedAt, {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }),
    orderId: order.id,
    lines,
    isIntraState,
    placeOfSupply: order.shippingAddress.state ?? "—",
    grandTotalInr,
    taxableValueInr: taxable,
    totalTaxInr: tax,
    cgstInr,
    sgstInr,
    igstInr,
    gstRatePct,
    hsn,
    amountInWords: rupeesInWords(grandTotalInr),
    paidOnlineInr,
    dueOnDeliveryInr,
    seller,
  };
}
