import numpy as np

DESCRIPTION = "SNR1: foreground standard deviation divided by background standard deviation."


def snr1(fg, bg=None):
    name = "SNR1"
    if fg is None or bg is None or fg.size == 0 or getattr(bg, "size", 0) == 0:
        return name, float("nan")
    sigma_f = np.nanstd(fg)
    sigma_b = np.nanstd(bg)
    if not np.isfinite(sigma_f) or not np.isfinite(sigma_b) or sigma_b == 0:
        return name, float("nan")
    return name, float(sigma_f / sigma_b)
