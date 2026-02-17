import numpy as np
from scipy.signal import convolve2d as conv2

DESCRIPTION = "Foreground local contrast (centered point processing); NaN if foreground empty."


def cpp(fg, bg=None):
    """
    MRI IQM: Centered Point Processing (local contrast proxy)

    Applies a simple 3x3 filter to foreground pixels and averages the response.
    """
    name = "CPP"
    if fg is None or fg.size == 0:
        return name, float("nan")

    filt = np.array([
        [-1/8, -1/8, -1/8],
        [-1/8,  1.0, -1/8],
        [-1/8, -1/8, -1/8]
    ])
    # reshape 1D to 2D (N x 1) if needed
    arr = fg.reshape(-1, 1) if fg.ndim == 1 else fg
    I_hat = conv2(arr, filt, mode="same")
    measure = float(np.nanmean(I_hat))
    return name, measure
