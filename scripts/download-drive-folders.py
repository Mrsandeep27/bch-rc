#!/usr/bin/env python3
"""
Download all PRC new-store product-photo folders from Google Drive — robustly.

Why the custom walk instead of gdown.download_folder():
  1. gdown does NOT strip ':' from Drive *folder* names, so a subfolder like
     "Polo RC drift car blue 1:24 Photos" crashes mkdir on Windows (WinError 267).
  2. gdown's folder download fires file requests back-to-back and Google
     rate-limits anonymous access ("Cannot retrieve the public link ... many
     accesses") after ~30 files, killing the rest of the batch.

This version:
  - reuses gdown's internal tree parser to enumerate every file id + path,
  - sanitizes EACH path component for Windows (':' '<' '>' '"' '/' '\\' '|' '?' '*'),
  - downloads file-by-file with pacing + exponential backoff so the throttle
    has time to reset,
  - skips files already on disk (safe to re-run).

Usage:
    python scripts/download-drive-folders.py
"""

import os
import re
import sys
import time

import gdown
from gdown.download import _get_session
from gdown.download_folder import _download_and_parse_google_drive_link

DEST = r"C:\Users\H\Downloads\prc-new-stores"

# (subfolder-name, drive-folder-url)
FOLDERS = [
    ("folder-01", "https://drive.google.com/drive/folders/1g8_2GIR0vb6UQHo3Bh9QMA6-FqX9P42I"),
    ("folder-02", "https://drive.google.com/drive/folders/1Ui1yYEHwBBn_LP0PCJpR_ziC_uwD0_Tr"),
    ("folder-03", "https://drive.google.com/drive/folders/1Fok3sAkmbRpGTiKvq8-zOYIkTEChSX2z"),
    ("folder-04", "https://drive.google.com/drive/folders/1JW_arkR_RnFQ5oy5qRMf3Ta4gejWVVD9"),
    ("folder-05", "https://drive.google.com/drive/folders/15aIZHFsBy5ovTecRznDxqpMFujenQk04"),
    ("folder-06", "https://drive.google.com/drive/folders/1XrruDkwznz31oUqGlgzrnMntGV5XFEFB"),
    ("folder-07", "https://drive.google.com/drive/folders/1ZVoan5xqAVoLUye6OlKz5FzxnJI6IVfN"),
    ("folder-08", "https://drive.google.com/drive/folders/1mEcm5PzpFc4j5BbiuoRiEzPeQrG2h8Uv"),
    ("folder-09", "https://drive.google.com/drive/folders/1l2X7IuFpaZ_U52uACCSjEHT17oOsrgAU"),
]

_ILLEGAL = re.compile(r'[<>:"/\\|?*\x00-\x1f]')
_UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/98.0.4758.102 Safari/537.36"
)


def san(name: str) -> str:
    """Make a single path component safe for Windows."""
    cleaned = _ILLEGAL.sub("-", name).strip().rstrip(". ")
    return cleaned or "unnamed"


def collect(node, base, out):
    """Walk a parsed _GoogleDriveFile tree -> list of (file_id, abs_local_path)."""
    for child in node.children:
        cname = san(child.name)
        if child.is_folder():
            collect(child, os.path.join(base, cname), out)
        else:
            out.append((child.id, os.path.join(base, cname)))


def extract_id(url: str) -> str:
    return url.rstrip("/").split("/")[-1]


def dl_file(file_id: str, path: str, retries: int = 6) -> str:
    """Returns 'skip' | 'ok' | 'fail'."""
    if os.path.exists(path) and os.path.getsize(path) > 0:
        return "skip"
    os.makedirs(os.path.dirname(path), exist_ok=True)
    for attempt in range(retries):
        try:
            res = gdown.download(id=file_id, output=path, quiet=True, use_cookies=True)
            if res and os.path.exists(path) and os.path.getsize(path) > 0:
                return "ok"
        except Exception:  # noqa: BLE001
            pass
        # backoff: 5s, 10s, 15s ... lets Google's throttle reset
        time.sleep(min(60, 5 * (attempt + 1)))
    return "fail"


def main() -> int:
    os.makedirs(DEST, exist_ok=True)
    sess, _ = _get_session(proxy=None, use_cookies=True, user_agent=_UA)

    # 1. Enumerate every file across all folders first.
    jobs = []  # (folder_label, file_id, local_path)
    for name, url in FOLDERS:
        fid = extract_id(url)
        try:
            tree = _download_and_parse_google_drive_link(
                sess=sess, folder_id=fid, quiet=True
            )
        except Exception as e:  # noqa: BLE001
            print(f"!! enumerate FAILED {name}: {e}", flush=True)
            continue
        files = []
        collect(tree, os.path.join(DEST, name), files)
        print(f"{name}: {len(files)} files", flush=True)
        for f_id, path in files:
            jobs.append((name, f_id, path))

    total = len(jobs)
    print(f"\nTotal files to fetch: {total}\n", flush=True)

    # 2. Download with pacing.
    ok = skip = fail = 0
    failed_paths = []
    for i, (name, f_id, path) in enumerate(jobs, 1):
        status = dl_file(f_id, path)
        if status == "ok":
            ok += 1
        elif status == "skip":
            skip += 1
        else:
            fail += 1
            failed_paths.append(path)
            print(f"  FAIL {os.path.relpath(path, DEST)}", flush=True)
        time.sleep(0.8)  # gentle pacing between files
        if i % 10 == 0 or i == total:
            print(f"  [{i}/{total}] ok={ok} skip={skip} fail={fail}", flush=True)

    print("\n" + "=" * 50, flush=True)
    print(f"DONE  ok={ok}  skip={skip}  fail={fail}  (total {total})", flush=True)
    if failed_paths:
        print("Still failed (re-run to retry — finished files are skipped):")
        for p in failed_paths:
            print(f"  - {os.path.relpath(p, DEST)}")
    print(f"Saved under: {DEST}", flush=True)
    return 1 if fail else 0


if __name__ == "__main__":
    sys.exit(main())
