import numpy as np

DESCRIPTION = (
    "Entropy focus criterion: normalized Shannon entropy of foreground; "
    "higher values suggest more ghosting/noise."
)


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
    efc_val = efc_val / np.log(n)
    return name, float(efc_val)
