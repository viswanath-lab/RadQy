import numpy as np

DESCRIPTION = "SNR3: foreground standard deviation divided by centered-foreground standard deviation (stability check)."


def snr3(fg, bg=None):
    name = "SNR3"
    if fg is None or fg.size == 0:
        return name, float("nan")
    sigma_f = np.nanstd(fg)
    centered_sigma = np.nanstd(fg - np.nanmean(fg))
    if not np.isfinite(sigma_f) or not np.isfinite(centered_sigma) or centered_sigma == 0:
        return name, float("nan")
    return name, float(sigma_f / centered_sigma)
