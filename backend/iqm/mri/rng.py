import numpy as np

DESCRIPTION = "Foreground intensity range (max - min); NaN if foreground empty."


def rng(fg, bg=None):
    """
    MRI IQM: Foreground Range

    Parameters
    ----------
    fg : np.ndarray
        Foreground pixel values (1D or 2D flattened).
    bg : unused

    Returns
    -------
    name : str
        "RNG"
    measure : float
        Range of foreground, or NaN if undefined.
    """
    name = "RNG"
    measure = float(np.ptp(fg)) if fg is not None and fg.size else float("nan")
    return name, measure
