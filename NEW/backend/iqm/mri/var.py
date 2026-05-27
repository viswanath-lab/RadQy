import numpy as np

DESCRIPTION = "Foreground intensity variance; NaN if foreground empty."


def var(fg, bg=None):
    """
    MRI IQM: Foreground Variance

    Returns
    -------
    ("VAR", variance) with NaN if undefined.
    """
    name = "VAR"
    measure = float(np.nanvar(fg)) if fg is not None and fg.size else float("nan")
    return name, measure
