import numpy as np

CNR_DESCRIPTION = "Contrast-to-noise ratio: (mu_fg - mu_bg) divided by background standard deviation."
CVP_DESCRIPTION = "Coefficient of variation of foreground patch: sigma_fg / mu_fg."
CJV_DESCRIPTION = "Coefficient of joint variation between foreground and background: (sigma_fg + sigma_bg) / |mu_fg - mu_bg|."


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


def cvp(fg, bg=None):
    name = "CVP"
    if fg is None or fg.size == 0:
        return name, float("nan")
    mu_f = np.nanmean(fg)
    sigma_f = np.nanstd(fg)
    if not np.isfinite(mu_f) or mu_f == 0 or not np.isfinite(sigma_f):
        return name, float("nan")
    return name, float(sigma_f / mu_f)


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
