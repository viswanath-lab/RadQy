import numpy as np

DESCRIPTION = "Foreground coefficient of variation (%) ; NaN if mean is zero/undefined."


def cv(fg, bg=None):
    """
    MRI IQM: Coefficient of Variation (percent)

    Returns
    -------
    ("CV", value) where value is NaN if foreground empty or mean is zero.
    """
    name = "CV"
    if fg is not None and fg.size and np.nanmean(fg) != 0:
        measure = float((np.nanstd(fg) / np.nanmean(fg)) * 100.0)
    else:
        measure = float("nan")
    return name, measure
