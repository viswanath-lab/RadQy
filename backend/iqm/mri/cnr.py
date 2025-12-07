import numpy as np

DESCRIPTION = "CNR: (mu_fg - mu_bg) divided by background standard deviation."


def cnr(fg, bg=None):
    name = "CNR"
    if fg is None or bg is None or fg.size == 0 or getattr(bg, "size", 0) == 0:
        return name, float("nan")
    mu_f = np.nanmean(fg)
    mu_b = np.nanmean(bg)
    sigma_b = np.nanstd(bg)
    if not np.isfinite(mu_f) or not np.isfinite(mu_b) or not np.isfinite(sigma_b) or sigma_b == 0:
        return name, float("nan")
    return name, float((mu_f - mu_b) / sigma_b)
