/**
 * GET /api/health/inventory
 *
 * Bootstrap-safety probe. Returns 200 only when every orderable variant has an
 * inventory row; returns 503 with the exact missing keys otherwise. Point an
 * uptime monitor or post-deploy check at this so a forgotten
 * `npm run db:seed-inventory` is caught before customers hit a broken checkout
 * (the serverless equivalent of "startup validation detects missing inventory").
 */

import { NextResponse } from "next/server";
import { getInventoryHealth } from "@/lib/inventory";
import { logError } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const health = await getInventoryHealth();
    return NextResponse.json(
      {
        ok: health.ok,
        expectedCount: health.expectedCount,
        configuredCount: health.configuredCount,
        totalUnits: health.totalUnits,
        missing: health.missing.map((m) => m.key),
        soldOut: health.soldOut.map((m) => m.key),
        lowStock: health.lowStock.map((m) => m.key),
        orphanKeys: health.orphanKeys,
        ...(health.ok
          ? {}
          : { fix: "Run `npm run db:seed-inventory` (and `db:push`) against this environment." }),
      },
      { status: health.ok ? 200 : 503 },
    );
  } catch (err) {
    logError("api:health:inventory", err);
    return NextResponse.json(
      { ok: false, error: "inventory health check failed" },
      { status: 503 },
    );
  }
}
