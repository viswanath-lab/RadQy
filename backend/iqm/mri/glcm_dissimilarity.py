import numpy as np
from ._spatial import masked_image

DESCRIPTION = (
    "GLCM Dissimilarity: mean absolute gray-level difference weighted by co-occurrence; "
    "higher indicates more contrasty texture."
)

from .glcm_contrast import _glcm


def glcm_dissimilarity(fg, bg=None, *, mask=None):
    name = "GLCM_DISS"
    arr = masked_image(fg, mask)
    P = _glcm(arr) if arr is not None else None
    if P is None:
        return name, float("nan")
    i = np.arange(P.shape[0])[:, None]
    j = np.arange(P.shape[1])[None, :]
    diss = np.sum(np.abs(i - j) * P)
    return name, float(diss)
