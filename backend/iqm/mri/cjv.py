import numpy as np

DESCRIPTION = "CJV: (sigma_fg + sigma_bg) divided by |mu_fg - mu_bg|."


def cjv(fg, bg=None):
    name = "CJV"
    if fg is None or bg is None or fg.size == 0 or getattr(bg, "size", 0) == 0:
        return name, float("nan")
    mu_f = np.nanmean(fg)
    mu_b = np.nanmean(bg)
    sigma_f = np.nanstd(fg)
    sigma_b = np.nanstd(bg)
    denom = abs(mu_f - mu_b)
    if not np.isfinite(mu_f) or not np.isfinite(mu_b) or not np.isfinite(sigma_f) or not np.isfinite(sigma_b) or denom == 0:
        return name, float("nan")
    return name, float((sigma_f + sigma_b) / denom)
