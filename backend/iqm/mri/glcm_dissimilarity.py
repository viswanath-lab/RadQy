import numpy as np

DESCRIPTION = (
    "GLCM Dissimilarity: mean absolute gray-level difference weighted by co-occurrence; "
    "higher indicates more contrasty texture."
)

from .glcm_contrast import _glcm


def glcm_dissimilarity(fg, bg=None):
    name = "GLCM_DISS"
    P = _glcm(fg)
    if P is None:
        return name, float("nan")
    i = np.arange(P.shape[0])[:, None]
    j = np.arange(P.shape[1])[None, :]
    diss = np.sum(np.abs(i - j) * P)
    return name, float(diss)
