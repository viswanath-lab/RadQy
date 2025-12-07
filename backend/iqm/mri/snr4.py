import numpy as np

DESCRIPTION = "SNR4: foreground mean divided by background mean."


def snr4(fg, bg=None):
    name = "SNR4"
    if fg is None or bg is None or fg.size == 0 or getattr(bg, "size", 0) == 0:
        return name, float("nan")
    mu_f = np.nanmean(fg)
    mu_b = np.nanmean(bg)
    if not np.isfinite(mu_f) or not np.isfinite(mu_b) or mu_b == 0:
        return name, float("nan")
    return name, float(mu_f / mu_b)
