import numpy as np

DESCRIPTION = "SNR2: foreground mean divided by background standard deviation."


def snr2(fg, bg=None):
    name = "SNR2"
    if fg is None or bg is None or fg.size == 0 or getattr(bg, "size", 0) == 0:
        return name, float("nan")
    mu_f = np.nanmean(fg)
    sigma_b = np.nanstd(bg)
    if not np.isfinite(mu_f) or not np.isfinite(sigma_b) or sigma_b == 0:
        return name, float("nan")
    return name, float(mu_f / sigma_b)
