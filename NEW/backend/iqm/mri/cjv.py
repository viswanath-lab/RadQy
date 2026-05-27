import numpy as np

DESCRIPTION = (
    "CJV: (sigma_fg + sigma_bg)/|mu_fg - mu_bg| when background is usable; "
    "fallback to foreground homogeneity mu_F/sigma_F if background is missing or invalid."
)


def _fg_stability(fg):
    mu_f = np.nanmean(fg)
    sigma_f = np.nanstd(fg)
    if sigma_f == 0 or not np.isfinite(mu_f) or not np.isfinite(sigma_f):
        return float("nan")
    return float(mu_f / sigma_f)


def cjv(fg, bg=None):
    name = "CJV"
    if fg is None or fg.size == 0:
        return name, float("nan")
    mu_f = np.nanmean(fg)
    sigma_f = np.nanstd(fg)

    if bg is None or getattr(bg, "size", 0) == 0:
        return name, _fg_stability(fg)

    mu_b = np.nanmean(bg)
    sigma_b = np.nanstd(bg)
    denom = abs(mu_f - mu_b)
    if not np.isfinite(mu_f) or not np.isfinite(mu_b) or not np.isfinite(sigma_f) or not np.isfinite(sigma_b) or denom == 0:
        return name, _fg_stability(fg)
    return name, float((sigma_f + sigma_b) / denom)
