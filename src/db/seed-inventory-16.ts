/**
 * DEPRECATED (2026-07-08) — ONE single inventory now.
 *
 * The 1:16 store's separate "prc16" inventory keyspace is gone: all rows were
 * re-keyed to site_id "prc" and every scale seeds from the one catalog-driven
 * seeder. Running the old version of this script would have recreated prc16
 * rows that nothing reads and the admin health page can't see.
 *
 * Use instead: `npm run db:seed-inventory` (src/db/seed-inventory.ts).
 */

console.error(
  "seed-inventory-16 is deprecated: inventory is single-site ('prc') now.\n" +
    "Run `npm run db:seed-inventory` instead — it seeds every scale, 1:16 included.",
);
process.exit(1);
