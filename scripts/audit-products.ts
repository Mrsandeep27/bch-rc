/**
 * Full product audit. For every SKU in PRODUCTS:
 *   1. Visible (not hidden + not internal) vs internal-only vs hidden
 *   2. PDP returns 200 on prod
 *   3. Each color variant has a matching inventory row, and stock matches
 *   4. retailINR + mrpINR sane
 *   5. heroImage + variant images present
 *   6. Free-ship threshold check (₹1099) — flag SKUs that price above this
 *
 * Stops the user from "going live with broken cards" — exactly the
 * end-to-end check requested.
 */

import { eq, and, inArray } from "drizzle-orm";
import { db } from "../src/db";
import { inventory } from "../src/db/schema";
import { PRODUCTS } from "../src/lib/products";
import { existsSync } from "node:fs";
import { join } from "node:path";

const SITE_ID = "prc";
const PROD_BASE = "https://pocketrccars.com";
const PUBLIC_DIR = join(process.cwd(), "public");

type AuditRow = {
  sku: string;
  status: "VISIBLE" | "INTERNAL" | "HIDDEN";
  priceInr: number;
  freeShip: boolean;
  pdpStatus: number | string;
  variants: number;
  invRowsExpected: number;
  invRowsFound: number;
  invMismatches: string[];
  missingImages: string[];
  warnings: string[];
};

async function fetchStatus(url: string): Promise<number | string> {
  try {
    const res = await fetch(url, { method: "HEAD", redirect: "follow" });
    return res.status;
  } catch (err) {
    return `ERR ${err instanceof Error ? err.message : err}`;
  }
}

function imgPresent(rel: string): boolean {
  if (!rel) return false;
  // Public-served paths like "/products/foo.jpg" → public/products/foo.jpg
  const local = rel.startsWith("/") ? rel.slice(1) : rel;
  return existsSync(join(PUBLIC_DIR, local));
}

async function main() {
  // One DB roundtrip for all inventory under this site.
  const skuIds = PRODUCTS.map((p) => p.id);
  const invRows = await db
    .select()
    .from(inventory)
    .where(and(eq(inventory.siteId, SITE_ID), inArray(inventory.skuId, skuIds)));
  const invByKey = new Map<string, number>();
  for (const r of invRows) {
    invByKey.set(`${r.skuId}::${r.variantSlug}`, r.stock);
  }

  const rows: AuditRow[] = [];

  for (const sku of PRODUCTS) {
    const status: AuditRow["status"] = sku.hidden
      ? "HIDDEN"
      : sku.internal
        ? "INTERNAL"
        : "VISIBLE";

    const variants = sku.colors ?? [];
    const expectedKeys = variants.length
      ? variants.map((c) => `${sku.id}::${c.slug}`)
      : [`${sku.id}::`];

    const invFound = expectedKeys.filter((k) => invByKey.has(k));
    const invMismatches: string[] = [];
    for (const c of variants) {
      const dbStock = invByKey.get(`${sku.id}::${c.slug}`);
      if (dbStock === undefined) {
        invMismatches.push(`${c.slug}: NO inventory row`);
      } else if (dbStock !== c.stock) {
        invMismatches.push(
          `${c.slug}: catalog stock=${c.stock} but inventory=${dbStock}`,
        );
      }
    }
    if (variants.length === 0) {
      const dbStock = invByKey.get(`${sku.id}::`);
      if (dbStock === undefined) {
        invMismatches.push(`(no-variant): NO inventory row`);
      }
    }

    const missingImages: string[] = [];
    if (sku.heroImage && !imgPresent(sku.heroImage)) {
      missingImages.push(`hero:${sku.heroImage}`);
    }
    for (const a of sku.altImages) {
      if (!imgPresent(a)) missingImages.push(`alt:${a}`);
    }
    for (const c of variants) {
      if (c.image && !imgPresent(c.image)) {
        missingImages.push(`variant ${c.slug}:${c.image}`);
      }
    }

    const warnings: string[] = [];
    if (sku.retailINR <= 0) warnings.push(`retailINR=${sku.retailINR}`);
    if (sku.mrpINR < sku.retailINR) warnings.push(`mrpINR<retailINR`);
    if (status !== "INTERNAL" && sku.retailINR < 1099) {
      warnings.push(`retail ₹${sku.retailINR} < freeship threshold ₹1099 — buyer pays ₹85 shipping`);
    }
    if (variants.length === 0 && status !== "INTERNAL") {
      warnings.push(`no color variants — buyers can't pick`);
    }

    // PDP HEAD check (skip hidden — they 404 by design)
    let pdpStatus: number | string = "skipped";
    if (status !== "HIDDEN") {
      pdpStatus = await fetchStatus(`${PROD_BASE}/product/${sku.slug}`);
    }

    rows.push({
      sku: sku.id,
      status,
      priceInr: sku.retailINR,
      freeShip: sku.retailINR >= 1099,
      pdpStatus,
      variants: variants.length,
      invRowsExpected: expectedKeys.length,
      invRowsFound: invFound.length,
      invMismatches,
      missingImages,
      warnings,
    });
  }

  console.log("\n=== PRODUCT AUDIT ===");
  console.log("SKU | STATUS | ₹PRICE | FREESHIP | PDP | VARIANTS | INV_FOUND/EXPECTED");
  for (const r of rows) {
    console.log(
      `${r.sku} | ${r.status} | ₹${r.priceInr} | ${r.freeShip ? "y" : "n"} | ${r.pdpStatus} | ${r.variants} | ${r.invRowsFound}/${r.invRowsExpected}`,
    );
  }

  let totalIssues = 0;
  console.log("\n=== ISSUES ===");
  for (const r of rows) {
    const issues: string[] = [];
    if (r.status !== "HIDDEN" && r.pdpStatus !== 200) {
      issues.push(`PDP ${r.pdpStatus}`);
    }
    if (r.invRowsFound < r.invRowsExpected) {
      issues.push(`missing inventory rows: ${r.invRowsExpected - r.invRowsFound}`);
    }
    for (const m of r.invMismatches) issues.push(m);
    for (const m of r.missingImages) issues.push(`missing image ${m}`);
    for (const w of r.warnings) issues.push(`WARN ${w}`);

    if (issues.length > 0) {
      console.log(`\n${r.sku} (${r.status}):`);
      for (const i of issues) console.log(`  - ${i}`);
      totalIssues += issues.length;
    }
  }

  if (totalIssues === 0) {
    console.log("All products clean — every SKU is end-to-end ready.");
  } else {
    console.log(`\n${totalIssues} issue(s) found across ${rows.length} SKUs.`);
  }

  process.exit(0);
}
main();
