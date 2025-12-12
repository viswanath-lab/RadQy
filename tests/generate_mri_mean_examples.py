"""Generate sample MEAN slices with OtsuHull-masked fg/bg images for LaTeX figures.

Randomly selects 10 MRI volumes under examples/MRI, keeps the middle 90% of
each volume, picks one random slice, runs OtsuHull, and writes fg/bg PNGs
(intensity-masked images, not binary masks) plus a summary CSV to
docs/tex/Figure/MRI/MEAN.
"""

import csv
import random
import sys
from pathlib import Path

import imageio.v2 as imageio
import numpy as np
import pydicom


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[2]


def _parse_folder(folder_name: str):
    parts = folder_name.split("_")
    if len(parts) >= 3:
        body = parts[0]
        plane = parts[-1]
        sequence = " ".join(parts[1:-1]).strip()
    else:
        body = folder_name
        sequence = ""
        plane = ""
    return body, sequence, plane


def _load_slices(volume_dir: Path):
    slices = []
    for dcm_path in sorted(volume_dir.glob("*.dcm")):
        ds = pydicom.dcmread(dcm_path)
        slope = float(getattr(ds, "RescaleSlope", 1.0))
        intercept = float(getattr(ds, "RescaleIntercept", 0.0))
        pix = ds.pixel_array.astype(np.float32) * slope + intercept
        if pix.ndim == 2:
            slices.append(pix)
        elif pix.ndim == 3:
            for i in range(pix.shape[0]):
                slices.append(pix[i])
    return slices


def _pick_middle_slice(slices):
    n = len(slices)
    if n == 0:
        return None, None
    start = int(n * 0.05)
    end = int(n * 0.95)
    if end <= start:
        start = 0
        end = n
    chunk = slices[start:end]
    idx_in_chunk = random.randrange(len(chunk))
    global_idx = start + idx_in_chunk  # zero-based
    return chunk[idx_in_chunk], global_idx + 1  # one-based for reporting


def main():
    repo = _repo_root()
    sys.path.append(str(repo))

    from backend.seg.mri.OtsuHull import normalize_uint16, run_otsuhull  # pylint: disable=import-error

    volumes_root = repo / "examples" / "MRI"
    out_dir = repo / "docs" / "tex" / "Figure" / "MRI" / "MEAN"
    out_dir.mkdir(parents=True, exist_ok=True)

    volume_dirs = [p for p in volumes_root.iterdir() if p.is_dir()]
    if not volume_dirs:
        print(f"No volumes found under {volumes_root}")
        return

    picked_volumes = random.sample(volume_dirs, k=min(10, len(volume_dirs)))

    records = []
    file_counter = 1

    for idx, vol_dir in enumerate(picked_volumes, start=1):
        slices = _load_slices(vol_dir)
        slice_img, slice_number = _pick_middle_slice(slices)
        if slice_img is None:
            print(f"Skipping {vol_dir.name}: no slices found")
            continue

        fg_mask, bg_mask = run_otsuhull(slice_img)
        im_u16 = normalize_uint16(slice_img)
        fg_img = (im_u16 * fg_mask).astype(np.uint16)  # intensities restricted to fg
        bg_img = (im_u16 * bg_mask).astype(np.uint16)  # intensities restricted to bg

        body, sequence, plane = _parse_folder(vol_dir.name)

        fg_name = f"a{file_counter}.png"
        bg_name = f"a{file_counter + 1}.png"
        file_counter += 2

        fg_path = out_dir / fg_name
        bg_path = out_dir / bg_name

        imageio.imwrite(fg_path, fg_img)
        imageio.imwrite(bg_path, bg_img)

        rel_fg = fg_path.relative_to(repo)
        rel_bg = bg_path.relative_to(repo)

        records.append(
            {
                "number": idx,
                "folder": vol_dir.name,
                "slice": slice_number,
                "body_part": body,
                "sequence": sequence,
                "plane": plane,
                "fg_path": str(rel_fg),
                "bg_path": str(rel_bg),
            }
        )

        print(f"[{idx}/10] {vol_dir.name}: slice {slice_number} -> {fg_path.name}, {bg_path.name}")

    if not records:
        print("No slices processed; nothing to write.")
        return

    csv_path = out_dir / "mean_samples.csv"
    with csv_path.open("w", newline="") as f:
        writer = csv.DictWriter(
            f,
            fieldnames=[
                "number",
                "folder",
                "slice",
                "body_part",
                "sequence",
                "plane",
                "fg_path",
                "bg_path",
            ],
        )
        writer.writeheader()
        writer.writerows(records)

    print(f"Wrote CSV with {len(records)} rows to {csv_path}")


if __name__ == "__main__":
    main()
