import numpy as np

EFC_DESCRIPTION = (
    "Entropy focus criterion: normalized Shannon entropy of foreground intensities; higher suggests more ghosting/noise."
)
FBER_DESCRIPTION = "Foreground-to-background energy ratio: median(fg^2) / median(bg^2)."


def efc(fg, bg=None):
    name = "EFC"
    if fg is None or fg.size == 0:
        return name, float("nan")

    arr = np.asarray(fg, dtype=float)
    arr = arr[np.isfinite(arr)]
    if arr.size == 0:
        return name, float("nan")

    norm = np.sqrt(np.sum(arr ** 2))
    if norm == 0 or not np.isfinite(norm):
        return name, float("nan")

    p = (arr / norm).clip(min=1e-12)
    efc_val = -np.sum(p * np.log(p))
    n = arr.size
    if n <= 1:
        return name, float("nan")
    # Normalize by log(n) to keep scale consistent across sizes
    efc_val = efc_val / np.log(n)
    return name, float(efc_val)


def fber(fg, bg=None):
    name = "FBER"
    if fg is None or bg is None or fg.size == 0 or getattr(bg, "size", 0) == 0:
        return name, float("nan")
    num = np.median(np.square(fg[np.isfinite(fg)])) if np.isfinite(fg).any() else float("nan")
    den = np.median(np.square(bg[np.isfinite(bg)])) if np.isfinite(bg).any() else float("nan")
    if not np.isfinite(num) or not np.isfinite(den) or den == 0:
        return name, float("nan")
    return name, float(num / den)
