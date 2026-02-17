"""
Legacy hybrid Otsu + convex hull foreground extractor, mirroring the
original snippet but returning masks only.

API (matches other segmenters in this folder):
    - normalize_uint16(img)     -> uint16 normalized image in [0, 65535]
    - run_otsuhull(img)         -> (fg, bg) masks in {0,1} with internal normalization
    - segment(img)              -> fg mask in {0,1}
    - make_masks(img)           -> (fg, bg) masks in {0,1}
    - hybrid_otsu_hull_foreground(img) -> (fg, bg) masks in {0,1}
"""

import argparse
from pathlib import Path

import imageio.v2 as iio
import numpy as np
from scipy.ndimage import binary_fill_holes

try:
    from skimage.exposure import equalize_hist as _sk_equalize_hist
    from skimage.filters import threshold_otsu as _sk_threshold_otsu
    from skimage.morphology import convex_hull_image as _sk_convex_hull_image
    _HAS_SKIMAGE = True
except Exception:
    _HAS_SKIMAGE = False


def _equalize_hist(img: np.ndarray) -> np.ndarray:
    if _HAS_SKIMAGE:
        return _sk_equalize_hist(img)

    # Fallback: simple histogram equalization on [0,1] float.
    x = img.astype(np.float32)
    x -= x.min()
    denom = (x.max() + 1e-8)
    x = np.clip(x / denom, 0.0, 1.0)
    hist, _ = np.histogram((x * 255).astype(np.uint8), bins=256, range=(0, 255))
    cdf = hist.cumsum()
    cdf = np.clip(cdf, 1, None)
    cdf = (cdf - cdf.min()) / (cdf.max() - cdf.min() + 1e-8)
    return cdf[(x * 255).astype(np.uint8)]


def _threshold_otsu(u8: np.ndarray) -> int:
    if _HAS_SKIMAGE:
        return int(_sk_threshold_otsu(u8))

    # Fallback Otsu for uint8-like arrays.
    h, _ = np.histogram(u8, bins=256, range=(0, 255))
    p = h.astype(np.float64) / max(u8.size, 1)
    w = np.cumsum(p)
    m = np.cumsum(p * np.arange(256))
    mt = m[-1]
    s = (mt * w - m) ** 2 / (w * (1.0 - w) + 1e-12)
    k = int(np.nanargmax(s))
    return k


def _convex_hull(mask: np.ndarray) -> np.ndarray:
    if _HAS_SKIMAGE:
        return _sk_convex_hull_image(mask.astype(bool)).astype(np.uint8)

    # Fallback: fill holes as a soft approximation.
    return binary_fill_holes(mask.astype(bool)).astype(np.uint8)


def hybrid_otsu_hull_foreground(img: np.ndarray):
    """
    Apply Otsu on raw + hist-equalized images, weight by FG fractions,
    re-threshold, then take convex hull. Mirrors the original `foreground`
    snippet semantics but returns only masks.

    Returns (fg_mask, bg_mask) as uint8 in {0,1}.
    """
    try:
        img_u = img.astype(np.uint16, copy=False)

        h = _equalize_hist(img_u) * 255

        oi = (img_u > _threshold_otsu(img_u)).astype(np.uint8)
        oh = (h > _threshold_otsu(h)).astype(np.uint8)

        nm = float(img_u.size)
        w1 = float(oi.sum()) / nm
        w2 = float(oh.sum()) / nm

        new = (w1 * img_u) + (w2 * h)
        ots = (new > _threshold_otsu(new)).astype(np.uint8)

        conv_hull = _convex_hull(ots)
        ch = conv_hull.astype(img_u.dtype)

        fg = conv_hull.astype(np.uint8)
        bg = (1 - fg).astype(np.uint8)
    except Exception:
        fg = np.ones_like(img, dtype=np.uint8)
        bg = np.zeros_like(img, dtype=np.uint8)

    return fg, bg


def normalize_uint16(img: np.ndarray) -> np.ndarray:
    """Normalize any numeric array to uint16 on [0, 65535]."""
    x = np.asarray(img, dtype=np.float32)
    x = x - x.min()
    maxv = x.max()
    if maxv > 0:
        x = x / maxv
    return (x * 65535.0).astype(np.uint16)


def run_otsuhull(img: np.ndarray):
    """
    Convenience wrapper: normalize input to uint16 then return (fg, bg) masks.
    """
    img_u16 = normalize_uint16(img)
    return make_masks(img_u16)


def segment(img: np.ndarray) -> np.ndarray:
    """Return binary foreground mask (convex hull) in {0,1} for a single 2D image."""
    fg, _ = hybrid_otsu_hull_foreground(img)
    return fg.astype(np.uint8)


def make_masks(img: np.ndarray):
    """
    Input: 2D numpy array (image)
    Output: (foreground_mask, background_mask) in {0,1}
    """
    fg = segment(img).astype(np.uint8)
    bg = (1 - fg).astype(np.uint8)
    return fg, bg


# -------- CLI helpers --------
def _load_image(path: Path) -> np.ndarray:
    """Load image (PNG/JPG/TIF) or .npy array and return as ndarray."""
    if path.suffix.lower() == ".npy":
        arr = np.load(path)
    else:
        arr = iio.imread(path)
    if arr.ndim == 3:
        arr = np.mean(arr[..., :3], axis=2)  # grayscale for RGB/RGBA
    return np.asarray(arr)


def _save_mask(mask: np.ndarray, out_path: Path) -> None:
    out_path.parent.mkdir(parents=True, exist_ok=True)
    iio.imwrite(out_path, (mask.astype(np.uint8) * 255))


def _cli():
    parser = argparse.ArgumentParser(
        description="Run Otsu+convex hull segmentation and save fg/bg masks."
    )
    parser.add_argument("input", help="Path to input image (.png/.jpg/.tif) or .npy array.")
    parser.add_argument("--fg-out", help="Output path for foreground mask PNG.")
    parser.add_argument("--bg-out", help="Output path for background mask PNG.")
    args = parser.parse_args()

    in_path = Path(args.input)
    if not in_path.exists():
        raise FileNotFoundError(f"Input image not found: {in_path}")

    img = _load_image(in_path)
    fg, bg = make_masks(img)

    fg_out = Path(args.fg_out) if args.fg_out else in_path.with_name(in_path.stem + "_fg.png")
    bg_out = Path(args.bg_out) if args.bg_out else in_path.with_name(in_path.stem + "_bg.png")

    _save_mask(fg, fg_out)
    _save_mask(bg, bg_out)

    print(f"Saved masks: fg -> {fg_out}, bg -> {bg_out}; shape={fg.shape}")


__all__ = [
    "normalize_uint16",
    "run_otsuhull",
    "hybrid_otsu_hull_foreground",
    "segment",
    "make_masks",
]


if __name__ == "__main__":
    _cli()
