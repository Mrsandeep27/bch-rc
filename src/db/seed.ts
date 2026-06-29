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

  // prc16 — the 1:16 "Big" series, served on the prc16.pocketrccars.com
  // subdomain (STORE16_HOST). Same legal entity as prc; shares customers by
  // phone. orderIdPrefix stays "PRC" (one prefix across both stores by choice).
  await db
    .insert(sites)
    .values({
      id: "prc16",
      name: `${THEME.brandName} — Big (1:16)`,
      domain: "prc16.pocketrccars.com",
      scale: "1:16",
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

  console.log("✓ Site 'prc16' seeded (or already existed).");

  process.exit(0);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
