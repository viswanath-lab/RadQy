import numpy as np

DESCRIPTION = "FBER: foreground-to-background energy ratio, median(fg^2) / median(bg^2)."


def fber(fg, bg=None):
    name = "FBER"
    if fg is None or bg is None or fg.size == 0 or getattr(bg, "size", 0) == 0:
        return name, float("nan")
    num = np.median(np.square(fg[np.isfinite(fg)])) if np.isfinite(fg).any() else float("nan")
    den = np.median(np.square(bg[np.isfinite(bg)])) if np.isfinite(bg).any() else float("nan")
    if not np.isfinite(num) or not np.isfinite(den) or den == 0:
        return name, float("nan")
    return name, float(num / den)
