/**
 * /admin/orders/new — manual order creation.
 *
 * Used when a customer reaches Sandeep/Syed/Hassan on WhatsApp or phone
 * instead of buying on the website. Admin fills out customer + product +
 * optional direct-call discount, clicks Generate, Razorpay sends the
 * customer an SMS+email payment link, and the same downstream pipeline
 * (Shiprocket, confirmation email, admin dashboard) runs unchanged once
 * the customer pays.
 *
 * The actual logic lives in POST /api/admin/orders/create — this page
 * is just a server shell that gates by requireAdmin and hands the SKU
 * catalog to the client form.
 */

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { requireAdmin } from "@/lib/admin-auth";
import { getVisibleProducts } from "@/lib/products";
import { CreateOrderForm } from "./CreateOrderForm";

export const dynamic = "force-dynamic";

export default async function AdminCreateManualOrderPage() {
  await requireAdmin();
  // Surface every public SKU + every colour variant. Hidden / internal SKUs
  // are excluded (manual orders shouldn't touch the ₹1 QA SKU).
  const products = getVisibleProducts().map((p) => ({
    id: p.id,
    name: p.name,
    retailINR: p.retailINR,
    heroImage: p.heroImage,
    colors: p.colors?.map((c) => ({
      name: c.name,
      slug: c.slug,
      stock: c.stock,
    })),
  }));

  return (
    <div className="min-h-screen bg-brand-cream">
      <header className="bg-white border-b border-brand-line">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/admin/orders"
              className="inline-flex items-center gap-1 text-sm text-brand-ink-soft hover:text-brand-ink"
            >
              <ChevronLeft size={16} />
              Orders
            </Link>
            <span className="text-brand-line">/</span>
            <h1 className="font-display font-bold text-lg">
              New manual order
            </h1>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        <p className="text-sm text-brand-ink-soft mb-5 max-w-xl">
          Use this when a customer reaches you on WhatsApp or phone instead of
          the website. Razorpay will SMS them a payment link the moment you
          submit. Once they pay, the order automatically appears in the
          dashboard with a shipment created on Shiprocket.
        </p>
        <CreateOrderForm products={products} />
      </main>
    </div>
  );
}
