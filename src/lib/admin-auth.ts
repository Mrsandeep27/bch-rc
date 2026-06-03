/**
 * Admin auth helpers — used by /admin layout + admin API routes.
 *
 * Bootstrap pattern: when a user from ADMIN_FOUNDER_EMAILS signs in for
 * the first time, we auto-create their admins row with role=OWNER and
 * access to all sites. Once any owner exists, future admins are added
 * from the admin UI.
 */

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { admins, sites } from "@/db/schema";
import { createClient } from "./supabase/server";

export type AdminContext = {
  authUserId: string;
  email: string;
  name: string | null;
  role: "OWNER" | "MANAGER" | "SUPPORT";
  siteIds: string[];
};

const FOUNDER_EMAILS = (process.env.ADMIN_FOUNDER_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

/**
 * Resolve the current admin context from the Supabase session.
 * Returns null if no session, no admin row, or the user is inactive.
 */
export async function getAdminContext(): Promise<AdminContext | null> {
  const supabase = await createClient();
  // Middleware already validated the session via getUser() on this same
  // request. Reading from getSession() here is safe (the cookie was just
  // verified) and avoids a redundant network call to Supabase Auth.
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user;
  if (!user || !user.email) return null;

  const email = user.email.toLowerCase();

  // Fast path: read first. The admin row exists in >99% of layout renders
  // (anyone who got past login has already been bootstrapped). One SELECT.
  let [row] = await db.select().from(admins).where(eq(admins.email, email));

  // Slow path: only fall through to the founder bootstrap when the row is
  // genuinely missing. Avoids the previous "INSERT … ON CONFLICT DO NOTHING"
  // hitting the database on every single admin-page render.
  if (!row && FOUNDER_EMAILS.includes(email)) {
    const allSites = await db.select({ id: sites.id }).from(sites);
    const siteIds = allSites.map((s) => s.id);
    await db
      .insert(admins)
      .values({
        authUserId: user.id,
        email,
        name: (user.user_metadata?.name as string) || null,
        siteIds,
        role: "OWNER",
        active: true,
      })
      .onConflictDoNothing({ target: admins.email });
    [row] = await db.select().from(admins).where(eq(admins.email, email));
  }

  if (!row || !row.active) return null;

  return {
    authUserId: user.id,
    email: row.email,
    name: row.name,
    role: row.role,
    siteIds: row.siteIds,
  };
}

/**
 * Use at the top of an admin server component. Redirects to /admin/login
 * if no session, or 404s if the user isn't an admin.
 */
export async function requireAdmin(): Promise<AdminContext> {
  const ctx = await getAdminContext();
  if (!ctx) redirect("/admin/login");
  return ctx;
}
