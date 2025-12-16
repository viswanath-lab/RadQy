"""
Sample random MRI slices and run two segmenters on the exact same samples for side-by-side comparison.

Outputs (per sample) to docs/tex/Figure/MRI/seg/comparison:
  <stem>_im.png
  <stem>_<segA>_fg.png
  <stem>_<segA>_bg.png
  <stem>_<segB>_fg.png
  <stem>_<segB>_bg.png
Also writes index.csv with relative paths (from docs/tex) to simplify figure generation.
"""

import argparse
import csv
import re
import sys
from pathlib import Path
from typing import Callable, Tuple

import imageio.v2 as imageio
import numpy as np
import pydicom


def repo_root() -> Path:
    return Path(__file__).resolve().parents[1]


def safe_name(s: str) -> str:
    return re.sub(r"[^A-Za-z0-9._-]+", "_", s)


def load_segmenter(name: str) -> Callable[[np.ndarray], Tuple[np.ndarray, np.ndarray]]:
    key = name.lower()
    if key in {"otsuhull", "otsu-hull", "otsu_hull"}:
        from backend.seg.mri.OtsuHull import make_masks  # type: ignore
        return make_masks
    if key in {"adaptiveborder", "adaptive-border", "adaptive_border"}:
        from backend.seg.mri.AdaptiveBorderSeg import make_masks  # type: ignore
        return make_masks
    if key in {"unet", "u-net", "u_net"}:
        from backend.seg.mri import UNet  # type: ignore
        model = UNet.load_unet_model(UNet.DEFAULT_CKPT)
        return lambda img: UNet.make_masks(img, model=model)
    if key in {"fcn"}:
        from backend.seg.mri import UNet  # type: ignore
        fcn_ckpt = repo_root() / "backend" / "seg" / "mri" / "models" / "fcn.pt"
        model = UNet.load_unet_model(fcn_ckpt)
        return lambda img: UNet.make_masks(img, model=model)
    raise ValueError(f"Unknown segmenter '{name}'.")


def load_float_slice(dcm_path: Path, rng: np.random.Generator) -> Tuple[np.ndarray, str]:
    ds = pydicom.dcmread(dcm_path, stop_before_pixels=False, force=True)
    arr = ds.pixel_array
    slope = float(getattr(ds, "RescaleSlope", 1.0) or 1.0)
    intercept = float(getattr(ds, "RescaleIntercept", 0.0) or 0.0)

    slice_idx = 0
    if arr.ndim == 3:
        slice_idx = int(rng.integers(0, arr.shape[0]))
        arr = arr[slice_idx]
    img = arr.astype(np.float32) * slope + intercept
    label = str(getattr(ds, "InstanceNumber", slice_idx))
    return img, label


def to_uint8(img: np.ndarray) -> np.ndarray:
    lo, hi = np.percentile(img, (0.5, 99.5))
    if hi <= lo:
        hi = lo + 1.0
    x = np.clip((img - lo) / (hi - lo), 0.0, 1.0)
    return (x * 255.0).astype(np.uint8)


def parse_volume_info(name: str) -> tuple[str, str, str]:
    parts = name.split("_")
    if len(parts) >= 3:
        body = parts[0]
        sequence = parts[1]
        plane = "_".join(parts[2:])
        return body, sequence, plane
    return (parts + ["", "", ""])[:3]


def main() -> None:
    parser = argparse.ArgumentParser(description="Compare two MRI segmenters on the same random slices.")
    parser.add_argument("--root", type=str, default=None, help="Root folder containing volume subfolders (default: examples/MRI).")
    parser.add_argument("--out", type=str, default=None, help="Output dir (default: docs/tex/Figure/MRI/seg/comparison).")
    parser.add_argument("--num-vols", type=int, default=10, help="Number of volumes to sample.")
    parser.add_argument("--segmenter-a", type=str, default="otsuhull", help="First segmenter name.")
    parser.add_argument("--segmenter-b", type=str, default="unet", help="Second segmenter name.")
    parser.add_argument("--seed", type=int, default=None, help="Random seed.")
    args = parser.parse_args()

    root = Path(args.root) if args.root else repo_root() / "examples" / "MRI"
    if not root.exists():
        print(f"Root folder not found: {root}")
        return

    seg_a_name = safe_name(args.segmenter_a)
    seg_b_name = safe_name(args.segmenter_b)

    base_out = Path(args.out) if args.out else repo_root() / "docs" / "tex" / "Figure" / "MRI" / "seg" / "comparison"
    base_out.mkdir(parents=True, exist_ok=True)

    rng = np.random.default_rng(args.seed)
    sys.path.append(str(repo_root()))
    seg_a = load_segmenter(args.segmenter_a)
    seg_b = load_segmenter(args.segmenter_b)

    for png in base_out.glob("*.png"):
        try:
            png.unlink()
        except OSError:
            pass
    idx_csv = base_out / "index.csv"
    if idx_csv.exists():
        try:
            idx_csv.unlink()
        except OSError:
            pass
    rows = []

    volume_dirs = [p for p in root.iterdir() if p.is_dir() and any(p.glob("*.dcm"))]
    if not volume_dirs:
        print(f"No volume folders with .dcm found under {root}")
        return

    rng.shuffle(volume_dirs)
    picked = volume_dirs[: min(args.num_vols, len(volume_dirs))]

    for vol_dir in picked:
        dcm_files = list(vol_dir.glob("*.dcm"))
        if not dcm_files:
            continue
        dcm_path = rng.choice(dcm_files)
        try:
            img_f32, slice_label = load_float_slice(dcm_path, rng)
        except Exception as exc:  # noqa: BLE001
            print(f"Skip {dcm_path}: {exc}")
            continue

        try:
            fg_a, bg_a = seg_a(img_f32)
            fg_b, bg_b = seg_b(img_f32)
        except Exception as exc:  # noqa: BLE001
            print(f"Segmentation failed for {dcm_path}: {exc}")
            continue

        stem = f"{safe_name(vol_dir.name)}_{slice_label}"
        im_path = base_out / f"{stem}_im.png"
        fg_a_path = base_out / f"{stem}_{seg_a_name}_fg.png"
        bg_a_path = base_out / f"{stem}_{seg_a_name}_bg.png"
        fg_b_path = base_out / f"{stem}_{seg_b_name}_fg.png"
        bg_b_path = base_out / f"{stem}_{seg_b_name}_bg.png"

        body, sequence, plane = parse_volume_info(vol_dir.name)
        tex_root = repo_root() / "docs" / "tex"
        im_rel = im_path.relative_to(tex_root).as_posix()
        fg_a_rel = fg_a_path.relative_to(tex_root).as_posix()
        bg_a_rel = bg_a_path.relative_to(tex_root).as_posix()
        fg_b_rel = fg_b_path.relative_to(tex_root).as_posix()
        bg_b_rel = bg_b_path.relative_to(tex_root).as_posix()

        try:
            imageio.imwrite(im_path, to_uint8(img_f32))
            imageio.imwrite(fg_a_path, (fg_a.astype(np.uint8) * 255))
            imageio.imwrite(bg_a_path, (bg_a.astype(np.uint8) * 255))
            imageio.imwrite(fg_b_path, (fg_b.astype(np.uint8) * 255))
            imageio.imwrite(bg_b_path, (bg_b.astype(np.uint8) * 255))
            print(f"Wrote comparison for {stem}")
            rows.append(
                (
                    len(rows) + 1,
                    root.name,
                    body,
                    sequence,
                    plane,
                    slice_label,
                    seg_a_name,
                    seg_b_name,
                    im_rel,
                    fg_a_rel,
                    bg_a_rel,
                    fg_b_rel,
                    bg_b_rel,
                )
            )
        except Exception as exc:  # noqa: BLE001
            print(f"Save failed for {dcm_path}: {exc}")

    if rows:
        try:
            with idx_csv.open("w", newline="", encoding="utf-8") as f:
                writer = csv.writer(f)
                writer.writerow(
                    [
                        "num",
                        "scantype",
                        "bodypart",
                        "sequence",
                        "plane",
                        "slice",
                        "seg_a",
                        "seg_b",
                        "im",
                        "fg_a",
                        "bg_a",
                        "fg_b",
                        "bg_b",
                    ]
                )
                writer.writerows(rows)
            print(f"Wrote {idx_csv}")
        except Exception as exc:  # noqa: BLE001
            print(f"Failed to write index.csv: {exc}")
    else:
        print("No slices saved; CSV not written.")


if __name__ == "__main__":
    main()
