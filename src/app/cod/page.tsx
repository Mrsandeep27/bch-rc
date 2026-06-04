import { redirect } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { orders } from "@/db/schema";
import { isCodAuthenticated } from "@/lib/cod-auth";
import { CodOrderCard } from "./CodOrderCard";
import { CodSignOut } from "./CodSignOut";

export const dynamic = "force-dynamic";

/**
 * /cod — the COD verification queue. Lists every order sitting at
 * PENDING_COD_VERIFICATION with customer phone, address, and items so the
 * operator can call, confirm address + intent, then click Confirm/Reject.
 *
 * Unauthenticated → /cod/login (no flash, no leak: the redirect runs before
 * any DB read).
 */
export default async function CodConsole() {
  if (!(await isCodAuthenticated())) {
    redirect("/cod/login");
  }

  const pending = await db
    .select()
    .from(orders)
    .where(
      and(
        eq(orders.status, "PENDING_COD_VERIFICATION"),
        eq(orders.paymentMethod, "COD"),
      ),
    )
    .orderBy(asc(orders.placedAt));

  return (
    <div className="min-h-screen bg-brand-cream">
      <header className="bg-[#0b0b0c] text-white sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="font-display font-bold text-lg">
            PRC Cars <span className="text-brand-red">COD</span>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <span className="hidden sm:inline text-white/60">
              {pending.length} pending
            </span>
            <CodSignOut />
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        <div className="mb-6">
          <h1 className="font-display text-2xl font-bold">
            Pending COD orders
          </h1>
          <p className="text-sm text-brand-ink-soft mt-1">
            Call the customer, verify they really placed this order, then
            Confirm. Reject for fake/prank orders — inventory is returned and
            no email is sent.
          </p>
        </div>

        {pending.length === 0 ? (
          <div className="bg-white rounded-2xl p-10 text-center">
            <p className="text-lg font-semibold">All clear</p>
            <p className="text-sm text-brand-ink-soft mt-1">
              No COD orders waiting for verification.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {pending.map((o) => (
              <CodOrderCard key={o.id} order={o} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
