/**
 * GST tax-invoice PDF — generated from a ComputedInvoice with pdf-lib.
 *
 * Why pdf-lib (not puppeteer/react-pdf): it's pure JS with no headless browser
 * or native binary, so it runs reliably inside the Vercel serverless function
 * that drains the notification outbox. The trade-off is a hand-laid-out page
 * instead of reusing the /pack/invoice HTML — acceptable for a one-page invoice.
 *
 * IMPORTANT: the StandardFonts (Helvetica) use WinAnsi encoding, which has NO
 * glyph for the ₹ rupee sign — embedding it throws. So every amount is printed
 * as "Rs ..." and all text is sanitised to the WinAnsi-safe ASCII range before
 * drawing. (Switching to a custom Unicode font with ₹ would mean bundling a
 * .ttf; "Rs" is the standard fallback on Indian B2C invoices and avoids that.)
 */

import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import type { ComputedInvoice } from "@/lib/invoice";

export type InvoiceBuyer = {
  name: string;
  address?: {
    line1?: string;
    line2?: string | null;
    city?: string;
    state?: string;
    pincode?: string;
    phone?: string;
  } | null;
};

const INK = rgb(0.04, 0.04, 0.05);
const MUTED = rgb(0.4, 0.4, 0.42);
const LINE = rgb(0.85, 0.83, 0.78);
const RED = rgb(0.86, 0.15, 0.15);

/** Strip anything Helvetica/WinAnsi can't encode; map ₹ → "Rs ". */
function t(s: unknown): string {
  return String(s ?? "")
    .replace(/₹/g, "Rs ")
    .replace(/[^\x20-\x7E]/g, "")
    .trim();
}

function money(n: number): string {
  return `Rs ${Math.round(n).toLocaleString("en-IN")}`;
}

export async function renderInvoicePdfBase64(
  inv: ComputedInvoice,
  buyer: InvoiceBuyer,
): Promise<string> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595.28, 841.89]); // A4 portrait, points
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const M = 42; // page margin
  const right = page.getWidth() - M;
  let y = page.getHeight() - M;

  const text = (
    s: string,
    x: number,
    yy: number,
    opts: { size?: number; font?: PDFFont; color?: ReturnType<typeof rgb> } = {},
  ) => {
    page.drawText(t(s), {
      x,
      y: yy,
      size: opts.size ?? 9,
      font: opts.font ?? font,
      color: opts.color ?? INK,
    });
  };

  const textRight = (
    s: string,
    xRight: number,
    yy: number,
    opts: { size?: number; font?: PDFFont; color?: ReturnType<typeof rgb> } = {},
  ) => {
    const f = opts.font ?? font;
    const size = opts.size ?? 9;
    const w = f.widthOfTextAtSize(t(s), size);
    text(s, xRight - w, yy, opts);
  };

  const hr = (yy: number) => {
    page.drawLine({
      start: { x: M, y: yy },
      end: { x: right, y: yy },
      thickness: 0.7,
      color: LINE,
    });
  };

  /** Word-wrap to a max width; returns the lines. */
  const wrap = (s: string, max: number, size: number, f: PDFFont): string[] => {
    const words = t(s).split(/\s+/);
    const lines: string[] = [];
    let cur = "";
    for (const w of words) {
      const trial = cur ? `${cur} ${w}` : w;
      if (f.widthOfTextAtSize(trial, size) > max && cur) {
        lines.push(cur);
        cur = w;
      } else {
        cur = trial;
      }
    }
    if (cur) lines.push(cur);
    return lines;
  };

  const s = inv.seller;

  // ── Header: brand + TAX INVOICE ──────────────────────────────────────────
  text("PRC Cars", M, y, { size: 20, font: bold });
  textRight("TAX INVOICE", right, y, { size: 16, font: bold, color: RED });
  y -= 16;
  textRight(inv.isDraft ? "DRAFT — no GST number" : `Invoice No: ${inv.invoiceNumber}`, right, y, {
    size: 9,
    font: bold,
  });
  y -= 12;
  textRight(`Date: ${inv.invoiceDate}`, right, y, { size: 9 });
  y -= 12;
  textRight(`Order: ${inv.orderId}`, right, y, { size: 9, color: MUTED });

  // ── Seller block (left) ──────────────────────────────────────────────────
  let ys = y + 16; // align roughly with the invoice-no rows
  text(s.tradeName, M, ys, { size: 11, font: bold });
  ys -= 12;
  text(`Prop: ${s.legalName} (${s.constitution})`, M, ys, { size: 8.5, color: MUTED });
  ys -= 12;
  for (const ln of wrap(s.registeredAddress, 250, 8.5, font)) {
    text(ln, M, ys, { size: 8.5, color: MUTED });
    ys -= 11;
  }
  text(`GSTIN: ${s.gstin}`, M, ys, { size: 8.5, font: bold });
  ys -= 11;
  text(`HSN: ${inv.hsn}   State: ${s.stateName} (${s.stateCode})`, M, ys, {
    size: 8.5,
    color: MUTED,
  });

  y = Math.min(y, ys) - 18;
  hr(y);
  y -= 16;

  // ── Bill to ──────────────────────────────────────────────────────────────
  text("Bill to / Ship to", M, y, { size: 9, font: bold });
  textRight(`Place of supply: ${inv.placeOfSupply}`, right, y, { size: 8.5, color: MUTED });
  y -= 13;
  text(buyer.name || "Customer", M, y, { size: 10, font: bold });
  y -= 12;
  const a = buyer.address;
  if (a) {
    const addrLine = [a.line1, a.line2, a.city, a.state, a.pincode]
      .filter(Boolean)
      .join(", ");
    for (const ln of wrap(addrLine, 380, 9, font)) {
      text(ln, M, y, { size: 9, color: MUTED });
      y -= 11;
    }
    if (a.phone) {
      text(`Phone: ${a.phone}`, M, y, { size: 9, color: MUTED });
      y -= 11;
    }
  }
  y -= 6;

  // ── Line-items table ─────────────────────────────────────────────────────
  const colQty = right - 190;
  const colRate = right - 110;
  const colAmt = right;
  hr(y);
  y -= 13;
  text("Item", M, y, { size: 8.5, font: bold, color: MUTED });
  textRight("Qty", colQty + 10, y, { size: 8.5, font: bold, color: MUTED });
  textRight("Rate", colRate + 20, y, { size: 8.5, font: bold, color: MUTED });
  textRight("Amount", colAmt, y, { size: 8.5, font: bold, color: MUTED });
  y -= 6;
  hr(y);
  y -= 14;

  for (const li of inv.lines) {
    const descLines = wrap(li.description, colQty - M - 14, 9.5, font);
    text(descLines[0] ?? "Item", M, y, { size: 9.5 });
    textRight(String(li.qty), colQty + 10, y, { size: 9.5 });
    textRight(money(li.unitInclInr), colRate + 20, y, { size: 9.5 });
    textRight(money(li.lineInclInr), colAmt, y, { size: 9.5 });
    y -= 11;
    if (li.sku) {
      text(`HSN ${li.hsn} · ${li.sku}`, M, y, { size: 7.5, color: MUTED });
      y -= 10;
    } else {
      text(`HSN ${li.hsn}`, M, y, { size: 7.5, color: MUTED });
      y -= 10;
    }
    for (const extra of descLines.slice(1)) {
      text(extra, M, y, { size: 8, color: MUTED });
      y -= 10;
    }
    y -= 3;
  }

  hr(y);
  y -= 16;

  // ── Tax summary (right-aligned) ──────────────────────────────────────────
  const labelX = right - 110;
  const drawSummary = (label: string, val: string, opts: { bold?: boolean } = {}) => {
    const f = opts.bold ? bold : font;
    textRight(label, labelX, y, { size: 9.5, font: f, color: opts.bold ? INK : MUTED });
    textRight(val, colAmt, y, { size: 9.5, font: f });
    y -= 13;
  };

  drawSummary("Taxable value", money(inv.taxableValueInr));
  if (inv.isIntraState) {
    drawSummary(`CGST @ ${inv.gstRatePct / 2}%`, money(inv.cgstInr));
    drawSummary(`SGST @ ${inv.gstRatePct / 2}%`, money(inv.sgstInr));
  } else {
    drawSummary(`IGST @ ${inv.gstRatePct}%`, money(inv.igstInr));
  }
  y -= 2;
  hr(y);
  y -= 15;
  drawSummary("Invoice total", money(inv.grandTotalInr), { bold: true });

  // COD split — show what was paid online vs due at the door.
  if (inv.dueOnDeliveryInr > 0) {
    y -= 2;
    drawSummary("Paid online", money(inv.paidOnlineInr));
    drawSummary("Due on delivery (cash)", money(inv.dueOnDeliveryInr), { bold: true });
  }

  y -= 6;
  text(t(inv.amountInWords), M, y, { size: 9, font: bold });
  y -= 22;

  // ── Footer ───────────────────────────────────────────────────────────────
  hr(y);
  y -= 13;
  for (const ln of wrap(
    "This is a computer-generated tax invoice and does not require a signature. Prices are inclusive of GST. Goods sold are covered by a 7-day replacement on manufacturing defects only.",
    right - M,
    7.5,
    font,
  )) {
    text(ln, M, y, { size: 7.5, color: MUTED });
    y -= 10;
  }

  const bytes = await doc.save();
  return Buffer.from(bytes).toString("base64");
}
