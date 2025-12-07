import numpy as np
from scipy.signal import medfilt2d

# Descriptions for documentation/registry
PSNR_DESCRIPTION = (
    "Peak signal-to-noise ratio (dB) comparing the foreground to a smoothed reference "
    "(median filter if no background is provided); higher is better."
)
SNR1_DESCRIPTION = "SNR1: foreground standard deviation divided by background standard deviation."
SNR2_DESCRIPTION = "SNR2: foreground mean divided by background standard deviation."
SNR3_DESCRIPTION = "SNR3: foreground standard deviation divided by centered-foreground standard deviation (stability check)."
SNR4_DESCRIPTION = "SNR4: foreground mean divided by background mean."


def _finite_or_nan(x):
    try:
        val = float(x)
    except Exception:
        return float("nan")
    return val if np.isfinite(val) else float("nan")


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
        # use a median-smoothed version of foreground as reference
        arr2d = fg_f.reshape(-1, 1) if fg_f.ndim == 1 else fg_f
        ref = medfilt2d(arr2d, kernel_size=5)
        mse = np.nanmean((arr2d - ref) ** 2)

    if not np.isfinite(mse) or mse <= 0:
        return name, float("nan")
    psnr_val = 10.0 * np.log10((peak ** 2) / mse)
    return name, float(psnr_val)


def snr1(fg, bg=None):
    name = "SNR1"
    if fg is None or bg is None or fg.size == 0 or getattr(bg, "size", 0) == 0:
        return name, float("nan")
    sigma_f = np.nanstd(fg)
    sigma_b = np.nanstd(bg)
    if not np.isfinite(sigma_f) or not np.isfinite(sigma_b) or sigma_b == 0:
        return name, float("nan")
    return name, float(sigma_f / sigma_b)


def snr2(fg, bg=None):
    name = "SNR2"
    if fg is None or bg is None or fg.size == 0 or getattr(bg, "size", 0) == 0:
        return name, float("nan")
    mu_f = np.nanmean(fg)
    sigma_b = np.nanstd(bg)
    if not np.isfinite(mu_f) or not np.isfinite(sigma_b) or sigma_b == 0:
        return name, float("nan")
    return name, float(mu_f / sigma_b)


def snr3(fg, bg=None):
    name = "SNR3"
    if fg is None or fg.size == 0:
        return name, float("nan")
    sigma_f = np.nanstd(fg)
    centered_sigma = np.nanstd(fg - np.nanmean(fg))
    if not np.isfinite(sigma_f) or not np.isfinite(centered_sigma) or centered_sigma == 0:
        return name, float("nan")
    return name, float(sigma_f / centered_sigma)


def snr4(fg, bg=None):
    name = "SNR4"
    if fg is None or bg is None or fg.size == 0 or getattr(bg, "size", 0) == 0:
        return name, float("nan")
    mu_f = np.nanmean(fg)
    mu_b = np.nanmean(bg)
    if not np.isfinite(mu_f) or not np.isfinite(mu_b) or mu_b == 0:
        return name, float("nan")
    return name, float(mu_f / mu_b)
