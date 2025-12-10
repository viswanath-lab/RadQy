import numpy as np

DESCRIPTION = (
    "Wavelet Coefficient Energy (WCE): sum of squared high-frequency Haar coefficients; "
    "captures total detail energy in LH/HL/HH subbands."
)


def _haar_highbands(img):
    arr = np.asarray(img, dtype=float)
    if arr.ndim < 2:
        return None
    arr = arr[..., 0] if arr.ndim > 2 else arr
    if min(arr.shape) < 2:
        return None
    a = arr[0::2, 0::2]
    b = arr[0::2, 1::2]
    c = arr[1::2, 0::2]
    d = arr[1::2, 1::2]
    if a.size == 0 or b.size == 0 or c.size == 0 or d.size == 0:
        return None
    lh = (a - b + c - d) / 4.0
    hl = (a + b - c - d) / 4.0
    hh = (a - b - c + d) / 4.0
    return lh, hl, hh


def wavelet_wce(fg, bg=None):
    name = "WCE"
    bands = _haar_highbands(fg)
    if bands is None:
        return name, float("nan")
    lh, hl, hh = bands
    coeffs = np.concatenate([np.ravel(lh), np.ravel(hl), np.ravel(hh)])
    coeffs = coeffs[np.isfinite(coeffs)]
    if coeffs.size == 0:
        return name, float("nan")
    return name, float(np.sum(coeffs ** 2))
