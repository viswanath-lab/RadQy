import numpy as np

DESCRIPTION = (
    "Foreground mean intensity; nan-aware and returns NaN when foreground is empty."
)

def mean(fg, bg=None):
    """
    MRI IQM: Foreground Mean Intensity

    Computes the nan-aware mean of the foreground values.
    - fg : numpy array (2D flattened or masked foreground pixel intensities)
    - bg : unused for this metric but kept for pipeline compatibility

    Returns
    -------
    name : str
        Standardized IQM code for pipeline
    measure : float
        Foreground mean intensity (nan if undefined)
    """

    name = "MEAN"

    # Professional nan handling:
    # -> If fg exists but is invalid, return nan (not zero)
    measure = float(np.nanmean(fg)) if fg is not None and fg.size > 0 else float("nan")

    return name, measure
