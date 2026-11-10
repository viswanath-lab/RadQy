import numpy as np
from ._spatial import masked_image

DESCRIPTION = (
    "Wavelet Quadrant Sparsity (WQS): fraction of near-zero high-frequency Haar coefficients; "
    "higher implies smoother slices."
)


def _haar_highbands(img):
    arr = np.asarray(img, dtype=float)
    if arr.ndim < 2:
        return None
    arr = arr[..., 0] if arr.ndim > 2 else arr
    if min(arr.shape) < 2:
        return None
    arr = arr[:arr.shape[0] // 2 * 2, :arr.shape[1] // 2 * 2]
    a = arr[0::2, 0::2]
    b = arr[0::2, 1::2]
    c = arr[1::2, 0::2]
    d = arr[1::2, 1::2]
    if a.size == 0 or b.size == 0 or c.size == 0 or d.size == 0:
        return None
    lh = (a - b + c - d) / 4.0
    hl = (a + b - c - d) / 4.0
    hh = (a - b - c + d) / 4.0
    return lh, hl, hh


def wavelet_wqs(fg, bg=None, tau: float = 1e-3, *, mask=None):
    name = "WQS"
    arr = masked_image(fg, mask)
    bands = _haar_highbands(arr) if arr is not None else None
    if bands is None:
        return name, float("nan")
    lh, hl, hh = bands
    coeffs = np.concatenate([np.ravel(lh), np.ravel(hl), np.ravel(hh)])
    coeffs = coeffs[np.isfinite(coeffs)]
    if coeffs.size == 0:
        return name, float("nan")
    frac_zero = float(np.mean(np.abs(coeffs) < tau))
    return name, frac_zero
