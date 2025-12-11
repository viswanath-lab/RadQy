#!/usr/bin/env python3
"""Copy a generated PDF from the LaTeX outDir to the repo docs folder.

Args: [outDir, docFile, repoDocs]
"""
from __future__ import annotations

import shutil
from pathlib import Path
import sys


def main() -> None:
    if len(sys.argv) < 4:
        print(
            "copy-pdf: missing args",
            {"outDir": sys.argv[1] if len(sys.argv) > 1 else None,
             "docFile": sys.argv[2] if len(sys.argv) > 2 else None,
             "repoDocs": sys.argv[3] if len(sys.argv) > 3 else None},
        )
        return

    out_dir = Path(sys.argv[1]).resolve()
    doc_file = sys.argv[2]
    repo_docs = Path(sys.argv[3]).resolve()

    src = out_dir / f"{doc_file}.pdf"
    dst = repo_docs / f"{doc_file}.pdf"

    if not src.exists():
        print(f"copy-pdf: source missing {src}")
        return

    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, dst)
    print(f"copy-pdf: {src} -> {dst}")


if __name__ == "__main__":
    main()
