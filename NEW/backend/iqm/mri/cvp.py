import numpy as np

DESCRIPTION = "CVP: coefficient of variation of the foreground patch (sigma_fg / mu_fg)."


def cvp(fg, bg=None):
    name = "CVP"
    if fg is None or fg.size == 0:
        return name, float("nan")
    mu_f = np.nanmean(fg)
    sigma_f = np.nanstd(fg)
    if not np.isfinite(mu_f) or mu_f == 0 or not np.isfinite(sigma_f):
        return name, float("nan")
    return name, float(sigma_f / mu_f)
