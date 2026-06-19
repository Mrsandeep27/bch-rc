import { notFound } from "next/navigation";
import Image from "next/image";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { orders } from "@/db/schema";
import { isPackAuthenticated } from "@/lib/pack-auth";
import { PackLoginForm } from "../../PackLoginForm";
import { computeInvoice, type InvoiceOrderItem } from "@/lib/invoice";
import { formatINR } from "@/lib/utils";
import { PrintButton } from "./PrintButton";
import { InvoiceNumberForm } from "./InvoiceNumberForm";

export const dynamic = "force-dynamic";

/**
 * /pack/invoice/[orderId] — PRC-branded GST tax invoice, print-ready.
 *
 * Replaces Shiprocket's generic invoice. The packing employee clicks
 * "Invoice" in the /pack console, this opens in a new tab, and they
 * Ctrl+P → Save as PDF (or print) to drop inside the parcel. Pack-auth
 * gated, same session as the rest of /pack.
 *
 * Layout follows the standard Indian D2C GST tax-invoice format (boAt /
 * Amazon style): seller + GSTIN header, bill-to / ship-to, HSN line items,
 * CGST/SGST or IGST summary, amount in words, declaration.
 */
export default async function InvoicePage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  if (!(await isPackAuthenticated())) return <PackLoginForm />;

  const { orderId } = await params;
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId));
  if (!order) notFound();

  const addr = (order.shippingAddress ?? {}) as {
    fullName?: string;
    phone?: string;
    line1?: string;
    line2?: string | null;
    city?: string;
    state?: string;
    pincode?: string;
    email?: string;
  };

  // Gate: no Zoho invoice number yet → show the entry form, not a draft
  // invoice. Nothing un-numbered should ever be printed for a customer.
  if (!order.invoiceNumber) {
    return (
      <div className="min-h-screen bg-neutral-100">
        <InvoiceNumberForm orderId={order.id} current={null} />
      </div>
    );
  }

  const inv = computeInvoice({
    id: order.id,
    invoiceNumber: order.invoiceNumber,
    placedAt: order.placedAt,
    items: (order.items as InvoiceOrderItem[]) ?? [],
    subtotalInr: order.subtotalInr,
    shippingInr: order.shippingInr,
    discountInr: order.discountInr,
    codFeeInr: order.codFeeInr,
    confirmationFeeInr: order.confirmationFeeInr,
    totalInr: order.totalInr,
    paymentMethod: order.paymentMethod,
    shippingAddress: addr,
  });

  const isCod = order.paymentMethod === "COD";

  return (
    <div className="min-h-screen bg-neutral-100 print:bg-white">
      {/* Toolbar — hidden when printing */}
      <div className="print:hidden sticky top-0 z-10 flex items-center justify-between gap-3 bg-neutral-900 px-4 py-3 text-white">
        <span className="text-sm font-mono uppercase tracking-widest text-neutral-300">
          Invoice · {order.invoiceNumber}
        </span>
        <PrintButton />
      </div>

      {/* A4 sheet */}
      <div className="mx-auto my-6 max-w-[820px] bg-white p-8 sm:p-10 text-[13px] leading-relaxed text-neutral-900 shadow-lg print:my-0 print:shadow-none print:max-w-none">
        {/* Header */}
        <div className="flex items-start justify-between border-b-2 border-neutral-900 pb-5">
          <div>
            <Image
              src="/logo/prc-logo-black-tight.png"
              alt="PRC Cars"
              width={150}
              height={48}
              className="h-auto w-[150px] object-contain"
            />
            <div className="mt-3 text-[12px] text-neutral-600">
              <div className="font-semibold text-neutral-900">
                {inv.seller.tradeName}
              </div>
              <div>Proprietor: {inv.seller.legalName}</div>
              <div className="max-w-[300px]">{inv.seller.registeredAddress}</div>
              <div className="mt-1">
                <span className="font-semibold">GSTIN:</span> {inv.seller.gstin}
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold uppercase tracking-tight text-neutral-900">
              Tax Invoice
            </div>
            <div className="mt-3 text-[12px]">
              <Row k="Invoice No" v={order.invoiceNumber} />
              <Row k="Invoice Date" v={inv.invoiceDate} />
              <Row k="Order ID" v={inv.orderId} />
              {order.awbCode && <Row k="AWB" v={order.awbCode} />}
            </div>
          </div>
        </div>

        {/* Bill to / Ship to */}
        <div className="grid grid-cols-2 gap-6 border-b border-neutral-300 py-5">
          <div>
            <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-neutral-500">
              Bill / Ship To
            </div>
            <div className="font-semibold">{addr.fullName ?? "—"}</div>
            <div className="text-neutral-700">
              {addr.line1}
              {addr.line2 ? `, ${addr.line2}` : ""}
            </div>
            <div className="text-neutral-700">
              {addr.city}, {addr.state} — {addr.pincode}
            </div>
            {addr.phone && (
              <div className="text-neutral-700">Phone: {addr.phone}</div>
            )}
          </div>
          <div className="text-right">
            <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-neutral-500">
              Supply Details
            </div>
            <Row k="Place of Supply" v={inv.placeOfSupply} right />
            <Row
              k="Payment"
              v={isCod ? "Cash on Delivery" : "Prepaid (online)"}
              right
            />
            <Row
              k="Tax Type"
              v={inv.isIntraState ? "CGST + SGST" : "IGST"}
              right
            />
          </div>
        </div>

        {/* Line items */}
        <table className="mt-5 w-full border-collapse text-[12px]">
          <thead>
            <tr className="border-b-2 border-neutral-900 text-left">
              <th className="py-2 pr-2 font-semibold">#</th>
              <th className="py-2 pr-2 font-semibold">Description</th>
              <th className="py-2 pr-2 text-center font-semibold">HSN</th>
              <th className="py-2 pr-2 text-center font-semibold">Qty</th>
              <th className="py-2 pr-2 text-right font-semibold">Rate</th>
              <th className="py-2 text-right font-semibold">Amount</th>
            </tr>
          </thead>
          <tbody>
            {inv.lines.map((l, i) => (
              <tr key={i} className="border-b border-neutral-200">
                <td className="py-2 pr-2 align-top">{i + 1}</td>
                <td className="py-2 pr-2 align-top">
                  <div className="flex items-center gap-2.5">
                    {l.image && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={l.image}
                        alt={l.description}
                        className="h-11 w-11 flex-none rounded-md border border-neutral-200 object-cover"
                      />
                    )}
                    <div>
                      <div className="font-semibold">{l.description}</div>
                      {l.sku && (
                        <div className="text-[11px] text-neutral-500">
                          SKU: {l.sku}
                        </div>
                      )}
                    </div>
                  </div>
                </td>
                <td className="py-2 pr-2 text-center align-top">{l.hsn}</td>
                <td className="py-2 pr-2 text-center align-top">{l.qty}</td>
                <td className="py-2 pr-2 text-right align-top tabular-nums">
                  {formatINR(l.unitInclInr)}
                </td>
                <td className="py-2 text-right align-top tabular-nums">
                  {formatINR(l.lineInclInr)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals — tax derived from GST-inclusive amount */}
        <div className="mt-4 flex justify-end">
          <div className="w-full max-w-[320px] text-[12px]">
            <Row k="Taxable Value" v={formatINR(inv.taxableValueInr)} right />
            {inv.isIntraState ? (
              <>
                <Row
                  k={`CGST @ ${inv.gstRatePct / 2}%`}
                  v={formatINR(inv.cgstInr)}
                  right
                />
                <Row
                  k={`SGST @ ${inv.gstRatePct / 2}%`}
                  v={formatINR(inv.sgstInr)}
                  right
                />
              </>
            ) : (
              <Row
                k={`IGST @ ${inv.gstRatePct}%`}
                v={formatINR(inv.igstInr)}
                right
              />
            )}
            <div className="mt-2 flex justify-between border-t-2 border-neutral-900 pt-2 text-[15px] font-bold">
              <span>Grand Total</span>
              <span className="tabular-nums">{formatINR(inv.grandTotalInr)}</span>
            </div>
          </div>
        </div>

        {/* Amount in words */}
        <div className="mt-3 border-t border-neutral-200 pt-3 text-[12px]">
          <span className="font-semibold">Amount in words: </span>
          {inv.amountInWords}
        </div>

        {/* COD split */}
        {isCod && order.confirmationFeeInr > 0 && (
          <div className="mt-4 rounded-lg border border-neutral-300 bg-neutral-50 p-3 text-[12px]">
            <div className="flex justify-between">
              <span>Paid online (confirmation)</span>
              <span className="font-semibold tabular-nums">
                {formatINR(inv.paidOnlineInr)}
              </span>
            </div>
            <div className="mt-1 flex justify-between font-bold">
              <span>Collect on delivery (cash)</span>
              <span className="tabular-nums">
                {formatINR(inv.dueOnDeliveryInr)}
              </span>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-8 grid grid-cols-2 gap-6 border-t border-neutral-300 pt-5 text-[11px] text-neutral-600">
          <div>
            <div className="font-semibold text-neutral-800">Declaration</div>
            <p className="mt-1">
              All prices are inclusive of GST. This is a computer-generated tax
              invoice and does not require a physical signature. Goods once
              sold are covered by our 7-day replacement policy (defects only).
            </p>
          </div>
          <div className="text-right">
            <div className="font-semibold text-neutral-800">
              For {inv.seller.tradeName}
            </div>
            <div className="mt-8">Authorised Signatory</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({
  k,
  v,
  right,
}: {
  k: string;
  v: string;
  right?: boolean;
}) {
  return (
    <div
      className={`flex justify-between gap-4 ${right ? "" : ""}`}
    >
      <span className="text-neutral-500">{k}</span>
      <span className="font-medium tabular-nums">{v}</span>
    </div>
  );
}
