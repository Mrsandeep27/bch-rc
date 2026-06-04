"""
Batch-convert all JPG/PNG product images under public/products to WebP.

- JPG / JPEG  → WebP, quality=82, method=6 (best compression).
- PNG (no alpha) → WebP, quality=82.
- PNG (with alpha) → WebP lossless to preserve transparency cleanly.

Writes <name>.webp alongside the original; the JPGs stay until you confirm
the swap (delete them in a follow-up once the site has been smoke-tested).

Run from repo root:  python scripts/to-webp.py
"""
from __future__ import annotations

from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1] / "public" / "products"
EXTS = {".jpg", ".jpeg", ".png"}


def has_alpha(img: Image.Image) -> bool:
    return img.mode in ("RGBA", "LA") or (
        img.mode == "P" and "transparency" in img.info
    )


def convert(src: Path) -> tuple[int, int]:
    dst = src.with_suffix(".webp")
    if dst.exists():
        return src.stat().st_size, dst.stat().st_size
    with Image.open(src) as img:
        alpha = has_alpha(img)
        if alpha:
            img = img.convert("RGBA")
            img.save(dst, "WEBP", lossless=True, method=6)
        else:
            img = img.convert("RGB")
            img.save(dst, "WEBP", quality=82, method=6)
    return src.stat().st_size, dst.stat().st_size


def main() -> None:
    files = [p for p in ROOT.rglob("*") if p.suffix.lower() in EXTS]
    print(f"Found {len(files)} source images under {ROOT}")
    total_src = 0
    total_dst = 0
    for i, p in enumerate(sorted(files), 1):
        try:
            s, d = convert(p)
        except Exception as e:
            print(f"  [{i}/{len(files)}] SKIP {p.name}: {e}")
            continue
        total_src += s
        total_dst += d
        if i % 10 == 0 or i == len(files):
            print(
                f"  [{i}/{len(files)}] {p.relative_to(ROOT)} "
                f"{s // 1024}KB -> {d // 1024}KB"
            )
    print()
    print(f"Source total:  {total_src / 1_048_576:.2f} MB")
    print(f"WebP total:    {total_dst / 1_048_576:.2f} MB")
    if total_src:
        saved = total_src - total_dst
        print(f"Saved:         {saved / 1_048_576:.2f} MB ({saved * 100 // total_src}%)")


if __name__ == "__main__":
    main()
