import numpy as np

DESCRIPTION = (
    "SNR2: mu_F / sigma_B when background is usable; "
    "fallback to foreground homogeneity mu_F/sigma_F if background is missing or invalid."
)


def _fg_stability(fg):
    mu_f = np.nanmean(fg)
    sigma_f = np.nanstd(fg)
    if sigma_f == 0 or not np.isfinite(mu_f) or not np.isfinite(sigma_f):
        return float("nan")
    return float(mu_f / sigma_f)


def snr2(fg, bg=None):
    name = "SNR2"
    if fg is None or fg.size == 0:
        return name, float("nan")
    mu_f = np.nanmean(fg)
    sigma_f = np.nanstd(fg)

    if bg is None or getattr(bg, "size", 0) == 0:
        return name, _fg_stability(fg)
    sigma_b = np.nanstd(bg)
    if sigma_b == 0 or not np.isfinite(sigma_b) or not np.isfinite(mu_f):
        return name, _fg_stability(fg)

    return name, float(mu_f / sigma_b)
