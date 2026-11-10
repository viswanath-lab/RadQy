"""Shared preparation for metrics that require spatial pixel relationships."""
import numpy as np


def masked_image(image, mask=None):
    """Keep the 2D geometry; represent excluded/nonfinite pixels as NaN."""
    arr = np.asarray(image, dtype=float)
    if arr.ndim != 2 or not arr.size:
        return None
    valid = np.isfinite(arr)
    if mask is not None:
        mask = np.asarray(mask, dtype=bool)
        if mask.shape != arr.shape:
            raise ValueError("Foreground mask must match the 2D image shape")
        valid &= mask
    if not valid.any():
        return None
    return np.where(valid, arr, np.nan)
