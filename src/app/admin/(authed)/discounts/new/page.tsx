import { requireAdmin } from "@/lib/admin-auth";
import CouponForm, { EMPTY_COUPON } from "../CouponForm";

export const dynamic = "force-dynamic";

export default async function NewDiscount() {
  await requireAdmin();
  return <CouponForm mode="create" initial={EMPTY_COUPON} />;
}
