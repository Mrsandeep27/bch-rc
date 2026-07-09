import { notFound } from "next/navigation";
import { and, eq, isNull, or, inArray } from "drizzle-orm";
import { db } from "@/db";
import { coupons } from "@/db/schema";
import { requireAdmin } from "@/lib/admin-auth";
import CouponForm, { type CouponFormValues } from "../CouponForm";

export const dynamic = "force-dynamic";

/** YYYY-MM-DD for a <input type="date">, in IST — matches how the actions parse. */
function istDateInput(d: Date | null): string {
  if (!d) return "";
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

export default async function EditDiscount({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await requireAdmin();
  const { id } = await params;

  // Scope to the admin's sites (plus legacy globals) so an id from another
  // site's coupon 404s instead of leaking.
  const scope =
    ctx.siteIds.length > 0
      ? or(inArray(coupons.siteId, ctx.siteIds), isNull(coupons.siteId))
      : isNull(coupons.siteId);

  const [c] = await db
    .select()
    .from(coupons)
    .where(and(eq(coupons.id, id), scope))
    .limit(1);
  if (!c) notFound();

  const initial: CouponFormValues = {
    code: c.code,
    type: c.type,
    // PERCENT is stored ×100; show the human percent back.
    value:
      c.type === "PERCENT"
        ? String(c.value / 100)
        : c.type === "FREE_SHIPPING"
          ? ""
          : String(c.value),
    minOrderInr: c.minOrderInr > 0 ? String(c.minOrderInr) : "",
    maxDiscountInr: c.maxDiscountInr != null ? String(c.maxDiscountInr) : "",
    usageLimit: c.usageLimit != null ? String(c.usageLimit) : "",
    perCustomerLimit:
      c.perCustomerLimit != null ? String(c.perCustomerLimit) : "",
    validFrom: istDateInput(c.validFrom),
    validTo: istDateInput(c.validTo),
    active: c.active,
  };

  return <CouponForm mode="edit" couponId={c.id} initial={initial} />;
}
