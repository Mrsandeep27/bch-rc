import { sql } from "drizzle-orm";
import { db } from "@/db";
import { requireAdmin } from "@/lib/admin-auth";
import { THEME } from "@/lib/theme";
import { AdminShell, type AdminCounts } from "./AdminShell";

/**
 * Auth-gated admin layout. Applies to everything inside
 * src/app/admin/(authed)/. The /admin/login route lives outside this group,
 * so it doesn't inherit the gate — no redirect loop.
 *
 * Server component: does the auth + the sidebar's live count badges in one
 * round-trip, then hands off to the client <AdminShell> (sidebar + drawer).
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await requireAdmin();
  const counts = await loadNavCounts(ctx.siteIds);

  return (
    <AdminShell
      email={ctx.email}
      role={ctx.role}
      brandName={THEME.brandName}
      logo={THEME.logoDark}
      counts={counts}
    >
      {children}
    </AdminShell>
  );
}

/**
 * Sidebar badge counts — real, cheap, indexed. One round-trip; best-effort
 * (a DB blip must never take down every admin page, so failures fall back to
 * no badges rather than throwing).
 *   • orders  = orders needing action (COD to verify + paid-but-unshipped)
 *   • reviews = reviews awaiting moderation
 */
async function loadNavCounts(siteIds: string[]): Promise<AdminCounts> {
  if (siteIds.length === 0) return {};
  try {
    const siteLiteral = sql`array[${sql.join(
      siteIds.map((s) => sql`${s}`),
      sql`, `,
    )}]::text[]`;
    const rows = (await db.execute(sql`
      SELECT
        (SELECT count(*)::int FROM orders
           WHERE site_id = ANY(${siteLiteral})
             AND (status = 'PENDING_COD_VERIFICATION'
                  OR (status = 'PAID' AND awb_code IS NULL))) AS open_orders,
        (SELECT count(*)::int FROM reviews WHERE status = 'pending') AS pending_reviews
    `)) as unknown as Array<{ open_orders: number; pending_reviews: number }>;
    const r = rows[0];
    return {
      orders: r?.open_orders ?? 0,
      reviews: r?.pending_reviews ?? 0,
    };
  } catch {
    return {};
  }
}
