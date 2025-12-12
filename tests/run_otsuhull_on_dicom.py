"""
Batch runner to apply the OtsuHull segmenter to DICOM slices and write PNG masks.

Reads all .dcm files under tests/dicom/Brain_T1_Axial and writes input/mask pairs to
tests/png/OtsuHull_Brain_T1_Axial/{im,fg}.
"""

from pathlib import Path
import sys

import imageio.v2 as imageio
import numpy as np
import pydicom


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[2]


def _iter_slices(dcm_path: Path):
    ds = pydicom.dcmread(dcm_path)
    slope = float(getattr(ds, "RescaleSlope", 1.0))
    intercept = float(getattr(ds, "RescaleIntercept", 0.0))
    pix = ds.pixel_array
    if pix.ndim == 2:
        img = pix.astype(np.float32) * slope + intercept
        yield None, img
    elif pix.ndim == 3:
        for i in range(pix.shape[0]):
            img = pix[i].astype(np.float32) * slope + intercept
            yield i, img
    else:
        raise ValueError(f"Unsupported pixel_array ndim={pix.ndim} in {dcm_path}")


def main():
    repo = _repo_root()
    sys.path.append(str(repo))

    from backend.seg.mri.OtsuHull import normalize_uint16, run_otsuhull  # pylint: disable=import-error

    dcm_dir = repo / "examples" / "dicom" / "Brain_T1_Axial"
    out_root = repo / "examples" / "png" / "OtsuHull_Brain_T1_Axial"
    im_dir = out_root / "im"
    fg_dir = out_root / "fg"
    im_dir.mkdir(parents=True, exist_ok=True)
    fg_dir.mkdir(parents=True, exist_ok=True)

    dcm_files = sorted(dcm_dir.rglob("*.dcm"))
    if not dcm_files:
        print(f"No DICOM files found under {dcm_dir}")
        return

    for dcm_path in dcm_files:
        for frame_idx, img in _iter_slices(dcm_path):
            fg, _ = run_otsuhull(img)
            fg_u8 = (fg.astype(np.uint8) * 255)
            stem = dcm_path.stem if frame_idx is None else f"{dcm_path.stem}_f{frame_idx:03d}"
            im_path = im_dir / f"{stem}.png"
            fg_path = fg_dir / f"{stem}_fg.png"
            imageio.imwrite(im_path, normalize_uint16(img))
            imageio.imwrite(fg_path, fg_u8)
            print(f"Wrote {im_path} and {fg_path}")


if __name__ == "__main__":
    main()
