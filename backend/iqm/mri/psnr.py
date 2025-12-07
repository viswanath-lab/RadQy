import numpy as np
from scipy.signal import medfilt2d

DESCRIPTION = (
    "Peak signal-to-noise ratio (dB) comparing the foreground to a smoothed reference "
    "(median filter if no background is provided); higher is better."
)


def psnr(fg, bg=None):
    """
    Peak Signal-to-Noise Ratio (dB).
    - If bg provided: PSNR between foreground and background.
    - Else: PSNR between foreground and its median-filtered version.
    """
    name = "PSNR"
    if fg is None or fg.size == 0:
        return name, float("nan")

    fg_f = np.asarray(fg, dtype=float)
    peak = np.nanmax(fg_f)
    if not np.isfinite(peak) or peak <= 0:
        return name, float("nan")

    if bg is not None and getattr(bg, "size", 0) > 0:
        ref = np.asarray(bg, dtype=float)
        mse = np.nanmean((fg_f - ref) ** 2)
    else:
        arr2d = fg_f.reshape(-1, 1) if fg_f.ndim == 1 else fg_f
        ref = medfilt2d(arr2d, kernel_size=5)
        mse = np.nanmean((arr2d - ref) ** 2)

    if not np.isfinite(mse) or mse <= 0:
        return name, float("nan")
    psnr_val = 10.0 * np.log10((peak ** 2) / mse)
    return name, float(psnr_val)
