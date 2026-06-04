/**
 * POST /api/admin/inventory  (admin-gated)
 *
 * Manual stock control from the admin dashboard:
 *  - mode "set":    absolute restock / starting stock (value >= 0). Upserts the
 *                   row, so it also CREATES the inventory row for a catalog
 *                   variant that doesn't have one yet (e.g. a newly added SKU).
 *  - mode "adjust": relative +/- delta, clamped at 0 (e.g. +40 when a carton
 *                   arrives, -2 to write off damaged units).
 *
 * Every change writes an `events` audit row (source="admin") with before/after
 * and the operator's email, so manual moves are distinguishable from the
 * order-driven decrement/restore path. Variants are validated against the
 * catalog (products.ts) so typos can't create junk rows.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { inventory, events } from "@/db/schema";
import { getAdminContext } from "@/lib/admin-auth";
import { INVENTORY_SITE_ID, expectedInventoryKeys } from "@/lib/inventory";
import { logError } from "@/lib/logger";

const Body = z.object({
  skuId: z.string().min(1).max(80),
  variantSlug: z.string().max(40), // "" for colourless SKUs
  mode: z.enum(["set", "adjust"]),
  value: z.number().int().min(-100000).max(100000),
});

export async function POST(req: Request) {
  const ctx = await getAdminContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch (err) {
    return NextResponse.json(
      { error: "Invalid body", details: err instanceof Error ? err.message : String(err) },
      { status: 400 },
    );
  }

  if (body.mode === "set" && body.value < 0) {
    return NextResponse.json({ error: "Stock can't be negative" }, { status: 400 });
  }

  // Only let admins manage variants that actually exist in the catalogue —
  // this is also the "new product variant" path: a catalog variant with no
  // inventory row yet is a valid key, and `set` creates the row.
  const known = expectedInventoryKeys().some(
    (k) => k.skuId === body.skuId && k.variantSlug === body.variantSlug,
  );
  if (!known) {
    return NextResponse.json(
      {
        error: `Unknown variant "${body.skuId}:${body.variantSlug}". Add the SKU/colour to the catalog (products.ts) first, then set its stock here.`,
      },
      { status: 400 },
    );
  }

  try {
    const result = await db.transaction(async (tx) => {
      const [existing] = await tx
        .select({ stock: inventory.stock })
        .from(inventory)
        .where(
          and(
            eq(inventory.siteId, INVENTORY_SITE_ID),
            eq(inventory.skuId, body.skuId),
            eq(inventory.variantSlug, body.variantSlug),
          ),
        );
      const before = existing?.stock ?? null;

      const target = [inventory.siteId, inventory.skuId, inventory.variantSlug];
      let after: number;

      if (body.mode === "set") {
        const [row] = await tx
          .insert(inventory)
          .values({
            siteId: INVENTORY_SITE_ID,
            skuId: body.skuId,
            variantSlug: body.variantSlug,
            stock: body.value,
          })
          .onConflictDoUpdate({
            target,
            set: { stock: body.value, updatedAt: new Date() },
          })
          .returning({ stock: inventory.stock });
        after = row.stock;
      } else {
        const [row] = await tx
          .insert(inventory)
          .values({
            siteId: INVENTORY_SITE_ID,
            skuId: body.skuId,
            variantSlug: body.variantSlug,
            stock: Math.max(0, body.value),
          })
          .onConflictDoUpdate({
            target,
            // GREATEST clamps at 0 so an over-large decrement can't go negative.
            set: {
              stock: sql`GREATEST(0, ${inventory.stock} + ${body.value})`,
              updatedAt: new Date(),
            },
          })
          .returning({ stock: inventory.stock });
        after = row.stock;
      }

      await tx.insert(events).values({
        siteId: INVENTORY_SITE_ID,
        type: body.mode === "set" ? "INVENTORY_ADMIN_SET" : "INVENTORY_ADMIN_ADJUST",
        payload: {
          skuId: body.skuId,
          variantSlug: body.variantSlug,
          mode: body.mode,
          value: body.value,
          before,
          after,
          by: ctx.email,
        },
        source: "admin",
      });

      return { before, after };
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    logError("api:admin:inventory", err, { skuId: body.skuId, variantSlug: body.variantSlug });
    return NextResponse.json({ error: "Failed to update stock" }, { status: 500 });
  }
}
