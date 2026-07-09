"use server";

/**
 * Customer CRM server actions. Real writes to the `customers` table, gated by
 * requireAdmin() AND a site-scope guard: an operator may only edit a customer
 * that belongs to one of their sites (either the customer's first_site_id is in
 * scope, or the customer has at least one order in a site the operator can see).
 * Customers are global by phone, so without this guard a manager for site A
 * could edit a buyer who only ever shopped site B.
 */

import { revalidatePath } from "next/cache";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { customers, orders } from "@/db/schema";
import { requireAdmin } from "@/lib/admin-auth";
import type { AdminContext } from "@/lib/admin-auth";

type Result = { ok: boolean; error?: string };

// Simple, deliberately permissive email shape check — we only reject obviously
// malformed input, not exotic-but-valid RFC addresses.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * True if `ctx` may act on the customer `id`. Cheap firstSiteId check first;
 * only falls through to the orders join when that misses.
 */
async function canEditCustomer(
  ctx: AdminContext,
  id: string,
): Promise<boolean> {
  const [row] = await db
    .select({ firstSiteId: customers.firstSiteId })
    .from(customers)
    .where(eq(customers.id, id));
  if (!row) return false;
  if (row.firstSiteId && ctx.siteIds.includes(row.firstSiteId)) return true;

  // Fallback: any visible order ties this customer to the operator's sites.
  const [order] = await db
    .select({ id: orders.id })
    .from(orders)
    .where(and(eq(orders.customerId, id), inArray(orders.siteId, ctx.siteIds)))
    .limit(1);
  return Boolean(order);
}

/**
 * Edit a customer's CRM fields (name, email, notes). Empty strings are stored
 * as NULL. Validates the email shape and field lengths, enforces site scope,
 * then revalidates the profile + list so the change is visible immediately.
 */
export async function updateCustomer(
  id: string,
  input: { name?: string; email?: string; notes?: string },
): Promise<Result> {
  const ctx = await requireAdmin();
  if (!id) return { ok: false, error: "Missing customer id" };

  const name = input.name?.trim() || null;
  const email = input.email?.trim() || null;
  const notes = input.notes?.trim() || null;

  if (email && !EMAIL_RE.test(email)) {
    return { ok: false, error: "Enter a valid email address." };
  }
  if (name && name.length > 120) {
    return { ok: false, error: "Name is too long (max 120 characters)." };
  }
  if (email && email.length > 200) {
    return { ok: false, error: "Email is too long (max 200 characters)." };
  }
  if (notes && notes.length > 5000) {
    return { ok: false, error: "Notes are too long (max 5000 characters)." };
  }

  if (!(await canEditCustomer(ctx, id))) {
    return { ok: false, error: "You don't have access to this customer." };
  }

  try {
    await db
      .update(customers)
      .set({ name, email, notes, updatedAt: new Date() })
      .where(eq(customers.id, id));
    revalidatePath(`/admin/customers/${id}`);
    revalidatePath("/admin/customers");
    return { ok: true };
  } catch {
    return { ok: false, error: "Save failed — try again." };
  }
}
