import numpy as np

DESCRIPTION = (
    "Fraction of non-finite values (NaN/inf) across foreground/background pixels; "
    "higher values flag poor foreground detection or corrupted slices."
)


def fail_fraction(fg, bg=None):
    """
    MRI IQM: Failure Fraction

    Computes the proportion of non-finite values in the provided foreground and
    background pixel arrays. The metric is nan-aware and returns NaN when no
    foreground values are available.

    Parameters
    ----------
    fg : np.ndarray
        Foreground pixel values (1D or 2D flattened).
    bg : np.ndarray, optional
        Background pixel values; included in the denominator when present.

    Returns
    -------
    name : str
        Short metric identifier.
    measure : float
        Fraction of non-finite values, or NaN if undefined.
    """
    name = "FAIL_FRAC"

    if fg is None or fg.size == 0:
        return name, float("nan")

    samples = [fg.ravel()]
    if bg is not None and getattr(bg, "size", 0) > 0:
        samples.append(bg.ravel())

    stacked = np.concatenate(samples) if samples else np.array([], dtype=np.float32)
    if stacked.size == 0:
        return name, float("nan")

    invalid_mask = ~np.isfinite(stacked)
    frac = invalid_mask.sum() / stacked.size
    return name, float(frac)
