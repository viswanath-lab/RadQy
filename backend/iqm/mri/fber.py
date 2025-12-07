import numpy as np

DESCRIPTION = (
    "FBER: median(fg^2)/median(bg^2) when background is usable; "
    "fallback to foreground homogeneity mu_F/sigma_F if background is missing or invalid."
)


def _fg_stability(fg):
    mu_f = np.nanmean(fg)
    sigma_f = np.nanstd(fg)
    if sigma_f == 0 or not np.isfinite(mu_f) or not np.isfinite(sigma_f):
        return float("nan")
    return float(mu_f / sigma_f)


def fber(fg, bg=None):
    name = "FBER"
    if fg is None or fg.size == 0:
        return name, float("nan")
    if bg is None or getattr(bg, "size", 0) == 0:
        return name, _fg_stability(fg)

    num = np.median(np.square(fg[np.isfinite(fg)])) if np.isfinite(fg).any() else float("nan")
    den = np.median(np.square(bg[np.isfinite(bg)])) if np.isfinite(bg).any() else float("nan")
    if not np.isfinite(num) or not np.isfinite(den) or den == 0:
        return name, _fg_stability(fg)
    return name, float(num / den)
