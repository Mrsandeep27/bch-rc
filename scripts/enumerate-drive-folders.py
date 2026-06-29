#!/usr/bin/env python3
"""List the real Drive folder/file names for each PRC link (no downloads)."""
import sys
from gdown.download import _get_session
from gdown.download_folder import _download_and_parse_google_drive_link

FOLDERS = [
    ("folder-01", "1g8_2GIR0vb6UQHo3Bh9QMA6-FqX9P42I"),
    ("folder-02", "1Ui1yYEHwBBn_LP0PCJpR_ziC_uwD0_Tr"),
    ("folder-03", "1Fok3sAkmbRpGTiKvq8-zOYIkTEChSX2z"),
    ("folder-04", "1JW_arkR_RnFQ5oy5qRMf3Ta4gejWVVD9"),
    ("folder-05", "15aIZHFsBy5ovTecRznDxqpMFujenQk04"),
    ("folder-06", "1XrruDkwznz31oUqGlgzrnMntGV5XFEFB"),
    ("folder-07", "1ZVoan5xqAVoLUye6OlKz5FzxnJI6IVfN"),
    ("folder-08", "1mEcm5PzpFc4j5BbiuoRiEzPeQrG2h8Uv"),
    ("folder-09", "1l2X7IuFpaZ_U52uACCSjEHT17oOsrgAU"),
]
_UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
       "(KHTML, like Gecko) Chrome/98.0.4758.102 Safari/537.36")


def walk(node, depth, lines):
    folders = [c for c in node.children if c.is_folder()]
    files = [c for c in node.children if not c.is_folder()]
    if files:
        lines.append("  " * depth + f"[{len(files)} images]")
    for f in folders:
        lines.append("  " * depth + f"|- {f.name}")
        walk(f, depth + 1, lines)


def main():
    sess, _ = _get_session(proxy=None, use_cookies=True, user_agent=_UA)
    for label, fid in FOLDERS:
        try:
            tree = _download_and_parse_google_drive_link(sess=sess, folder_id=fid, quiet=True)
        except Exception as e:  # noqa: BLE001
            print(f"\n{label}: ENUM FAILED: {e}")
            continue
        lines = []
        walk(tree, 1, lines)
        print(f"\n{label}  ==>  \"{tree.name}\"")
        for ln in lines:
            print(ln)
    return 0


if __name__ == "__main__":
    sys.exit(main())
