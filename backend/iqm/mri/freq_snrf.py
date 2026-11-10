import numpy as np
from ._spatial import masked_image

DESCRIPTION = (
    "Spectral SNR (SNRF): ratio of high-frequency to low-frequency FFT energy surrogate; "
    "acts as a sharpness vs. smoothness indicator."
)


def _safe_image(img):
    arr = np.asarray(img, dtype=float)
    if arr.ndim < 2:
        return None
    arr = arr[..., 0] if arr.ndim > 2 else arr
    if not np.isfinite(arr).any():
        return None
    return np.nan_to_num(arr, copy=True, nan=0.0, posinf=0.0, neginf=0.0)


def freq_snrf(fg, bg=None, *, mask=None):
    name = "SNRF"
    arr = masked_image(fg, mask)
    arr = _safe_image(arr) if arr is not None else None
    if arr is None:
        return name, float("nan")

    h, w = arr.shape
    r_low = max(2, int(0.1 * min(h, w)))
    r_high_inner = max(r_low + 1, int(0.15 * min(h, w)))
    r_high = max(r_high_inner + 1, int(0.45 * min(h, w)))

    fy = np.fft.fftfreq(h).reshape(-1, 1)
    fx = np.fft.fftfreq(w).reshape(1, -1)
    r = np.sqrt(fx * fx + fy * fy)

    mask_low = r <= (r_low / min(h, w))
    mask_high = (r >= (r_high_inner / min(h, w))) & (r <= (r_high / min(h, w)))

    if not np.any(mask_low) or not np.any(mask_high):
        return name, float("nan")

    mag = np.abs(np.fft.fft2(arr))
    lfr = float(np.mean(mag[mask_low]))
    hfr = float(np.mean(mag[mask_high]))

    eps = 1e-8
    return name, float(hfr / (lfr + eps))
