"use server";

/**
 * Review moderation server actions. Real writes to the `reviews` table, gated
 * by requireAdmin() (a non-admin is redirected before any mutation runs). The
 * legacy `approved` boolean is kept in sync with `status` so the storefront —
 * which still reads `approved` in older code paths — and the new status-based
 * queries never disagree.
 */

import { revalidatePath } from "next/cache";
import { and, eq, inArray, isNull, or } from "drizzle-orm";
import { db } from "@/db";
import { reviews } from "@/db/schema";
import { requireAdmin } from "@/lib/admin-auth";

type Result = { ok: boolean; error?: string };

async function setStatus(
  id: string,
  status: "pending" | "approved" | "rejected",
): Promise<Result> {
  await requireAdmin();
  if (!id) return { ok: false, error: "Missing review id" };
  try {
    await db
      .update(reviews)
      .set({ status, approved: status === "approved" })
      .where(eq(reviews.id, id));
    // Refresh the moderation queue and the storefront PDPs that surface reviews.
    revalidatePath("/admin/reviews");
    revalidatePath("/product/[slug]", "page");
    return { ok: true };
  } catch {
    return { ok: false, error: "Update failed — try again." };
  }
}

export async function approveReview(id: string): Promise<Result> {
  return setStatus(id, "approved");
}

export async function rejectReview(id: string): Promise<Result> {
  return setStatus(id, "rejected");
}

/** Send an approved/rejected review back to the pending queue. */
export async function resetReview(id: string): Promise<Result> {
  return setStatus(id, "pending");
}

/**
 * Permanently delete a review. Unlike the status actions this is scoped to the
 * admin's own sites (plus legacy null-site rows that everyone moderates) so an
 * admin can never delete a review belonging to a site they don't own, even if
 * they somehow guess its id. `.returning()` tells us whether a row actually
 * matched — a mismatched/foreign id deletes nothing and surfaces as an error
 * rather than a silent no-op. On success we refresh the queue and the PDPs.
 */
export async function deleteReview(id: string): Promise<Result> {
  const ctx = await requireAdmin();
  if (!id) return { ok: false, error: "Missing review id" };
  try {
    const deleted = await db
      .delete(reviews)
      .where(
        and(
          eq(reviews.id, id),
          or(inArray(reviews.siteId, ctx.siteIds), isNull(reviews.siteId)),
        ),
      )
      .returning({ id: reviews.id });
    if (deleted.length === 0) {
      return { ok: false, error: "Review not found." };
    }
    revalidatePath("/admin/reviews");
    revalidatePath("/product/[slug]", "page");
    return { ok: true };
  } catch {
    return { ok: false, error: "Delete failed — try again." };
  }
}
