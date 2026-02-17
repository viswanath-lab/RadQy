# HybridOtsuHullSeg.py
"""
Hybrid Otsu + Convex Hull Foreground Segmentation

Pipeline (2D slice):
1) Robust-normalize the image to [0, 1].
2) Compute masks from Otsu on the raw image AND on the histogram-equalized image.
3) Weight the two images by their respective FG fractions; re-threshold with Otsu.
4) Take the convex hull of the final mask for a clean, contiguous body region.
5) Return (fg, bg) as uint8 masks in {0,1}.

If scikit-image is not available, we fall back to internal Otsu + hist-eq and
skip a true convex hull (we approximate by fill-holes).
"""

import numpy as np
from scipy.ndimage import binary_fill_holes

# --- Optional: use scikit-image if present (recommended) ---
try:
    from skimage.exposure import equalize_hist as _sk_equalize_hist
    from skimage.filters import threshold_otsu as _sk_threshold_otsu
    from skimage.morphology import convex_hull_image as _sk_convex_hull_image
    _HAS_SKIMAGE = True
except Exception:
    _HAS_SKIMAGE = False


# ---------------- Utilities (with fallbacks) ----------------

def _normalize_robust(a: np.ndarray) -> np.ndarray:
    a = a.astype(np.float32)
    p1, p99 = np.percentile(a, (1, 99))
    a = np.clip(a, p1, p99)
    a -= a.min()
    denom = (a.max() + 1e-8)
    return a / denom

def _equalize_hist_own(img01: np.ndarray) -> np.ndarray:
    """Simple histogram equalization for [0,1] float image (fallback)."""
    x = np.clip(img01, 0.0, 1.0)
    hist, bins = np.histogram((x * 255).astype(np.uint8), bins=256, range=(0, 255))
    cdf = hist.cumsum()
    cdf = np.clip(cdf, 1, None)  # avoid zeros
    cdf = (cdf - cdf.min()) / (cdf.max() - cdf.min() + 1e-8)
    x8 = (x * 255).astype(np.uint8)
    return cdf[x8]

def _otsu_threshold_own(u8: np.ndarray) -> int:
    """Otsu threshold for uint8."""
    h, _ = np.histogram(u8, bins=256, range=(0, 255))
    p = h.astype(np.float64) / max(u8.size, 1)
    w = np.cumsum(p)
    m = np.cumsum(p * np.arange(256))
    mt = m[-1]
    s = (mt * w - m) ** 2 / (w * (1.0 - w) + 1e-12)
    k = int(np.nanargmax(s))
    return k

def _equalize_hist(img01: np.ndarray) -> np.ndarray:
    if _HAS_SKIMAGE:
        return _sk_equalize_hist(img01)
    return _equalize_hist_own(img01)

def _threshold_otsu(u8: np.ndarray) -> int:
    if _HAS_SKIMAGE:
        return int(_sk_threshold_otsu(u8))
    return _otsu_threshold_own(u8)

def _convex_hull(mask: np.ndarray) -> np.ndarray:
    if _HAS_SKIMAGE:
        return _sk_convex_hull_image(mask.astype(bool)).astype(np.uint8)
    # Fallback: not a true convex hull; fill holes as a soft approximation
    return binary_fill_holes(mask.astype(bool)).astype(np.uint8)


# ---------------- Core segmenters ----------------

def segment(u8: np.ndarray) -> np.ndarray:
    """
    Core 2D segmenter operating on a single slice.
    Input:  u8-like array (any dtype), will be normalized internally.
    Output: HxW uint8 mask in {0,1} (foreground).
    """
    # Normalize to [0,1]
    x = _normalize_robust(u8)

    # Equalized version in [0,1]
    h = _equalize_hist(x)

    # Convert to 8-bit for Otsu thresholding
    x8 = (x * 255).astype(np.uint8)
    h8 = (h * 255).astype(np.uint8)

    # Otsu masks on raw and equalized
    oi = (x8 > _threshold_otsu(x8)).astype(np.uint8)
    oh = (h8 > _threshold_otsu(h8)).astype(np.uint8)

    # Weights are FG area fractions
    nm = float(x.size)
    w1 = float(oi.sum()) / nm
    w2 = float(oh.sum()) / nm

    # Hybrid image (weighted raw + weighted equalized)
    new01 = np.clip(w1 * x + w2 * h, 0.0, 1.0)
    new8 = (new01 * 255).astype(np.uint8)

    # Final Otsu + convex hull
    ots = (new8 > _threshold_otsu(new8)).astype(np.uint8)
    hull = _convex_hull(ots)

    return hull  # foreground in {0,1}

def make_masks(img: np.ndarray):
    """
    Simple API expected by radqy:
    Input:  2D numpy array (H,W), any dtype
    Output: (fg, bg) as uint8 masks in {0,1}
    """
    fg = segment(img).astype(np.uint8)
    bg = (1 - fg).astype(np.uint8)
    return fg, bg
