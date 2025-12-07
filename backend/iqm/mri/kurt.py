import numpy as np

DESCRIPTION = "KURT: foreground excess kurtosis (fourth standardized moment minus 3); NaN if variance is zero or data missing."


def kurt(fg, bg=None):
    name = "KURT"
    if fg is None or fg.size == 0:
        return name, float("nan")
    x = np.asarray(fg, dtype=float)
    mu = np.nanmean(x)
    sigma = np.nanstd(x)
    if not np.isfinite(mu) or not np.isfinite(sigma) or sigma == 0:
        return name, float("nan")
    m4 = np.nanmean((x - mu) ** 4)
    excess = m4 / (sigma ** 4) - 3.0
    return name, float(excess)
