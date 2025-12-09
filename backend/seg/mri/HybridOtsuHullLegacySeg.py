"""
Legacy hybrid Otsu + convex hull foreground extractor, mirroring the
original snippet but returning masks only.

API (matches other segmenters in this folder):
    - segment(img)              -> fg mask in {0,1}
    - make_masks(img)           -> (fg, bg) masks in {0,1}
    - hybrid_otsu_hull_foreground(img) -> (fg, bg) masks in {0,1}
"""

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


__all__ = ["hybrid_otsu_hull_foreground", "segment", "make_masks"]
