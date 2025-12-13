"""
Sample a few random MRI volumes and slices, run a segmenter, and write image/fg/bg PNGs.

Default: root=examples/MRI, segmenter=OtsuHull, pick up to 10 volumes, one random slice each.
Outputs go to docs/tex/Figure/MRI/seg/<segmenter> with filenames:
    <volume_name>_<slice>_im.png
    <volume_name>_<slice>_fg.png
    <volume_name>_<slice>_bg.png
CSV index saved as docs/tex/Figure/MRI/seg/<segmenter>/index.csv
"""

import argparse
import re
import sys
import csv
from pathlib import Path
from typing import Callable, Tuple

import imageio.v2 as imageio
import numpy as np
import pydicom


def repo_root() -> Path:
    # tests/ -> repo root is one level up
    return Path(__file__).resolve().parents[1]


def safe_name(s: str) -> str:
    return re.sub(r"[^A-Za-z0-9._-]+", "_", s)


def load_segmenter(name: str) -> Callable[[np.ndarray], Tuple[np.ndarray, np.ndarray]]:
    """
    Return a callable img -> (fg, bg) for a known segmenter name.
    Supports: otsuhull, adaptiveborder, unet, fcn.
    """
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
    raise ValueError(f"Unknown segmenter '{name}'. Extend load_segmenter to add more.")


def load_float_slice(dcm_path: Path, rng: np.random.Generator) -> Tuple[np.ndarray, str]:
    """Load one slice from a DICOM (handles 2D or multi-frame) and return (float32_img, slice_label)."""
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
    """Simple 0.5/99.5 percentile window to uint8."""
    lo, hi = np.percentile(img, (0.5, 99.5))
    if hi <= lo:
        hi = lo + 1.0
    x = np.clip((img - lo) / (hi - lo), 0.0, 1.0)
    return (x * 255.0).astype(np.uint8)


def parse_volume_info(name: str) -> tuple[str, str, str]:
    """
    Expect folder name like {bodypart}_{sequence}_{plane}, e.g., Abdomen_T1_FSE_AX.
    Returns (bodypart, sequence, plane); falls back to empty strings if unavailable.
    """
    parts = name.split("_")
    if len(parts) >= 3:
        body = parts[0]
        sequence = parts[1]
        plane = "_".join(parts[2:])
        return body, sequence, plane
    # Fallback when format is unexpected
    return (parts + ["", "", ""])[:3]


def main():
    parser = argparse.ArgumentParser(description="Sample random MRI slices and save segmentation masks.")
    parser.add_argument("--root", type=str, default=None, help="Root folder containing volume subfolders (default: examples/MRI).")
    parser.add_argument("--out", type=str, default=None, help="Output dir (default: docs/tex/Figure/MRI/seg/<segmenter>).")
    parser.add_argument("--num-vols", type=int, default=10, help="Number of volumes to sample.")
    parser.add_argument("--segmenter", type=str, default="otsuhull", help="Segmenter name (default: otsuhull).")
    parser.add_argument("--seed", type=int, default=None, help="Random seed.")
    args = parser.parse_args()

    # Default root: <repo>/examples/MRI
    root = Path(args.root) if args.root else repo_root() / "examples" / "MRI"
    if not root.exists():
        print(f"Root folder not found: {root}")
        return
    seg_name = safe_name(args.segmenter.lower())
    base_out = Path(args.out) if args.out else repo_root() / "docs" / "tex" / "Figure" / "MRI" / "seg" / seg_name
    base_out.mkdir(parents=True, exist_ok=True)

    rng = np.random.default_rng(args.seed)
    sys.path.append(str(repo_root()))
    seg_fn = load_segmenter(args.segmenter)

    # Always clean output directory before saving new results
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

    # Find volume dirs containing DICOM files
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
            fg, bg = seg_fn(img_f32)
        except Exception as exc:  # noqa: BLE001
            print(f"Segmentation failed for {dcm_path}: {exc}")
            continue

        stem = f"{safe_name(vol_dir.name)}_{slice_label}"
        im_path = base_out / f"{stem}_im.png"
        fg_path = base_out / f"{stem}_fg.png"
        bg_path = base_out / f"{stem}_bg.png"

        body, sequence, plane = parse_volume_info(vol_dir.name)
        # paths relative to docs/tex for LaTeX-friendly includegraphics
        tex_root = repo_root() / "docs" / "tex"
        im_rel = im_path.relative_to(tex_root).as_posix()
        fg_rel = fg_path.relative_to(tex_root).as_posix()
        bg_rel = bg_path.relative_to(tex_root).as_posix()
        try:
            imageio.imwrite(im_path, to_uint8(img_f32))
            imageio.imwrite(fg_path, (fg.astype(np.uint8) * 255))
            imageio.imwrite(bg_path, (bg.astype(np.uint8) * 255))
            print(f"Wrote {im_path.name}, {fg_path.name}, {bg_path.name}")
            rows.append(
                (
                    len(rows) + 1,
                    root.name,
                    body,
                    sequence,
                    plane,
                    slice_label,
                    im_rel,
                    fg_rel,
                    bg_rel,
                )
            )
        except Exception as exc:  # noqa: BLE001
            print(f"Save failed for {dcm_path}: {exc}")

    # Write CSV index of saved files
    if rows:
        try:
            with idx_csv.open("w", newline="", encoding="utf-8") as f:
                writer = csv.writer(f)
                writer.writerow(["num", "scantype", "bodypart", "sequence", "plane", "slice", "im", "fg", "bg"])
                writer.writerows(rows)
            print(f"Wrote {idx_csv}")
        except Exception as exc:  # noqa: BLE001
            print(f"Failed to write index.csv: {exc}")
    else:
        print("No slices saved; CSV not written.")


if __name__ == "__main__":
    main()
