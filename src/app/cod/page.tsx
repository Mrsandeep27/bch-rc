import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { orders } from "@/db/schema";
import { isCodAuthenticated } from "@/lib/cod-auth";
import { CodLoginForm } from "./CodLoginForm";
import { CodOrderCard } from "./CodOrderCard";
import { CodSignOut } from "./CodSignOut";

export const dynamic = "force-dynamic";

/**
 * /cod — the COD verification queue. Lists every order sitting at
 * PENDING_COD_VERIFICATION with customer phone, address, and items so the
 * operator can call, confirm address + intent, then click Confirm/Reject.
 *
 * Auth flow: unauthenticated requests render the login form INLINE rather
 * than redirect() to /cod/login. Throwing NEXT_REDIRECT from a Server
 * Component is intercepted by Next.js's framework, but a custom root
 * error.tsx (which we have for the brand's "we hit a bump" page) catches
 * the throw before that interception runs and renders the error page
 * instead of the 307 — turning every fresh visit into a crash screen.
 * Rendering the form here side-steps the framework dance entirely.
 */
export default async function CodConsole() {
  const authed = await isCodAuthenticated();
  if (!authed) {
    return <CodLoginForm />;
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
