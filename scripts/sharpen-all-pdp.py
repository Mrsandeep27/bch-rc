"""Batch sharpen ALL cinematic PDP webps in public/products/colors/.

In-place re-encode with UnsharpMask + WebP q=92. Skips:
- The 5 hero versions already sharpened by sharpen-hero-cards.py
  (PRC-bmw-white-v2.webp, PRC-*-v3.webp at hero paths)
- Anything < 30 KB (probably already aggressive or a placeholder)

The PDP <Image quality={92}> change in PDPClient.tsx cache-busts the
Next.js Image URL so browsers fetch the freshly-sharpened variants.
"""

from pathlib import Path
from PIL import Image, ImageFilter

REPO = Path(__file__).resolve().parent.parent
COLORS = REPO / "public" / "products" / "colors"

# Don't re-sharpen these — they were just made by sharpen-hero-cards.py
ALREADY_SHARPENED = {
    "PRC-bmw-white-v2.webp",
    "PRC-porsche-green-v3.webp",
    "PRC-thar-blue-v3.webp",
    "PRC-monster-blue-v3.webp",
    "PRC-f1-classic-white-v3.webp",
}

UNSHARP = ImageFilter.UnsharpMask(radius=1.2, percent=140, threshold=2)


def sharpen_in_place(p: Path) -> None:
    before = p.stat().st_size
    img = Image.open(p).convert("RGB")
    img = img.filter(UNSHARP)
    img.save(p, "WEBP", quality=92, method=6)
    after = p.stat().st_size
    delta = after - before
    sign = "+" if delta >= 0 else ""
    print(f"OK  {p.name:<48}  {before//1024}KB -> {after//1024}KB ({sign}{delta//1024}KB)")


if __name__ == "__main__":
    files = sorted(COLORS.glob("*.webp"))
    skipped = 0
    done = 0
    for p in files:
        if p.name in ALREADY_SHARPENED:
            skipped += 1
            continue
        if p.stat().st_size < 30 * 1024:
            print(f"SKIP {p.name} (too small)")
            skipped += 1
            continue
        sharpen_in_place(p)
        done += 1
    print(f"\nDone: sharpened {done}, skipped {skipped}.")
