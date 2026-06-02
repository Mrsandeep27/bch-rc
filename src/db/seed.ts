/**
 * Seed: inserts ONLY the `sites` row for pocketrccars.com.
 *
 * Products are NOT seeded — Syed manages inventory externally and
 * src/lib/products.ts remains the source of truth for catalog until the
 * admin dashboard is built. When the time comes to migrate products into
 * the DB, do it in a separate, intentional pass.
 *
 * Run: `npm run db:seed`
 */

import { db } from "./index";
import { sites } from "./schema";
import { THEME } from "../lib/theme";

async function main() {
  console.log("Seeding sites...");

  await db
    .insert(sites)
    .values({
      id: "prc",
      name: THEME.brandName,
      domain: THEME.domain,
      scale: THEME.scaleFocus,
      orderIdPrefix: "PRC",
      brandTheme: {
        colors: THEME.colors,
        logo: {
          main: THEME.logoMain,
          dark: THEME.logoDark,
          badge: THEME.logoBadge,
          favicon: THEME.favicon,
        },
        copy: {
          heroH1: THEME.heroH1,
          heroSub: THEME.heroSub,
          tagline: THEME.tagline,
        },
      },
      gstin: THEME.legal.gstin,
      legalName: THEME.legal.legalName,
      registeredAddress: THEME.legal.registeredAddress,
      supportPhone: THEME.phoneDisplay,
      supportEmail: THEME.email,
    })
    .onConflictDoNothing({ target: sites.id });

  console.log("✓ Site 'prc' seeded (or already existed).");

  console.log("\nNext: 4 more sites for 1:43 / 1:32 / 1:24 / 1:18 / 1:10");
  console.log("Add via admin or rerun this seed after expanding the values.");

  process.exit(0);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
