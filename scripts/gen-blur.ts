/**
 * Build-time blur generator. Produces src/lib/blur-map.json = { imagePath ->
 * data:image/webp;base64 } tiny (16px) previews for product images, used by
 * <Image placeholder="blur" blurDataURL={...}> for a Zepto-style instant feel.
 *
 * Run:  npx tsx scripts/gen-blur.ts   (re-run when product images change)
 * Only product-card + color images are included to keep the JSON tiny.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { PRODUCTS } from "../src/lib/products";

const PUBLIC = join(process.cwd(), "public");
const paths = new Set<string>();
for (const p of PRODUCTS as any[]) {
  if (p.heroImage) paths.add(p.heroImage);
  for (const c of p.colors ?? []) if (c.image) paths.add(c.image);
}

async function main() {
  const out: Record<string, string> = {};
  let done = 0, skipped = 0;
  for (const rel of paths) {
    const file = join(PUBLIC, rel.replace(/^\//, ""));
    if (!existsSync(file)) { skipped++; continue; }
    try {
      const buf = await sharp(readFileSync(file))
        .resize(16, 16, { fit: "inside" })
        .webp({ quality: 40 })
        .toBuffer();
      out[rel] = `data:image/webp;base64,${buf.toString("base64")}`;
      done++;
    } catch {
      skipped++;
    }
  }

  const target = join(process.cwd(), "src/lib/blur-map.json");
  writeFileSync(target, JSON.stringify(out));
  console.log(`blur-map.json: ${done} images, ${skipped} skipped, ${Math.round(JSON.stringify(out).length / 1024)} KB`);
}
main();
