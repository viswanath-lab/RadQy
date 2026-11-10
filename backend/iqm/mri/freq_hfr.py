import numpy as np
from ._spatial import masked_image

DESCRIPTION = (
    "High-Frequency Response (HFR): mean FFT magnitude in an outer high-pass ring; "
    "higher values indicate sharper content."
)


def _safe_image(img):
    arr = np.asarray(img, dtype=float)
    if arr.ndim < 2:
        return None
    arr = arr[..., 0] if arr.ndim > 2 else arr
    if not np.isfinite(arr).any():
        return None
    return np.nan_to_num(arr, copy=True, nan=0.0, posinf=0.0, neginf=0.0)


def freq_hfr(fg, bg=None, *, mask=None):
    name = "HFR"
    arr = masked_image(fg, mask)
    arr = _safe_image(arr) if arr is not None else None
    if arr is None:
        return name, float("nan")

    h, w = arr.shape
    r_low = max(2, int(0.15 * min(h, w)))
    r_high = max(r_low + 1, int(0.45 * min(h, w)))

    fy = np.fft.fftfreq(h).reshape(-1, 1)
    fx = np.fft.fftfreq(w).reshape(1, -1)
    r = np.sqrt(fx * fx + fy * fy)
    mask = (r >= (r_low / min(h, w))) & (r <= (r_high / min(h, w)))
    if not np.any(mask):
        return name, float("nan")

    mag = np.abs(np.fft.fft2(arr))
    val = float(np.mean(mag[mask]))
    return name, val
