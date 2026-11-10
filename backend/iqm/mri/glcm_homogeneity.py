import numpy as np
from ._spatial import masked_image

DESCRIPTION = (
    "GLCM Homogeneity: weighted by inverse squared gray-level distance; "
    "higher indicates smoother texture."
)

from .glcm_contrast import _glcm


def glcm_homogeneity(fg, bg=None, *, mask=None):
    name = "GLCM_HOMOGENEITY"
    arr = masked_image(fg, mask)
    P = _glcm(arr) if arr is not None else None
    if P is None:
        return name, float("nan")
    i = np.arange(P.shape[0])[:, None]
    j = np.arange(P.shape[1])[None, :]
    hom = np.sum(P / (1.0 + (i - j) ** 2))
    return name, float(hom)
