import { db } from "../src/db";
import { inventory } from "../src/db/schema";
import { eq, and } from "drizzle-orm";

async function main() {
  const rows = await db
    .select()
    .from(inventory)
    .where(
      and(
        eq(inventory.skuId, "qa-1rs"),
        eq(inventory.variantSlug, ""),
      ),
    );
  console.log(JSON.stringify(rows, null, 2));
  process.exit(0);
}
main();
