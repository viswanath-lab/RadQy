import numpy as np

DESCRIPTION = "SKW: foreground skewness (third standardized moment); NaN if variance is zero or data missing."


def skw(fg, bg=None):
    name = "SKW"
    if fg is None or fg.size == 0:
        return name, float("nan")
    x = np.asarray(fg, dtype=float)
    mu = np.nanmean(x)
    sigma = np.nanstd(x)
    if not np.isfinite(mu) or not np.isfinite(sigma) or sigma == 0:
        return name, float("nan")
    m3 = np.nanmean((x - mu) ** 3)
    return name, float(m3 / (sigma ** 3))
