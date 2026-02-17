import numpy as np

DESCRIPTION = (
    "Low-Frequency Response (LFR): mean FFT magnitude in a central low-pass disk; "
    "higher values indicate more low-frequency (smooth) content."
)


def _safe_image(img):
    arr = np.asarray(img, dtype=float)
    if arr.ndim < 2:
        return None
    arr = arr[..., 0] if arr.ndim > 2 else arr
    if not np.isfinite(arr).any():
        return None
    return np.nan_to_num(arr, copy=False)


def freq_lfr(fg, bg=None):
    name = "LFR"
    arr = _safe_image(fg)
    if arr is None:
        return name, float("nan")

    h, w = arr.shape
    radius = max(2, int(0.1 * min(h, w)))
    fy = np.fft.fftfreq(h).reshape(-1, 1)
    fx = np.fft.fftfreq(w).reshape(1, -1)
    r = np.sqrt(fx * fx + fy * fy)
    mask = r <= (radius / min(h, w))
    if not np.any(mask):
        return name, float("nan")

    mag = np.abs(np.fft.fft2(arr))
    val = float(np.mean(mag[mask]))
    return name, val
