import numpy as np
from ._spatial import masked_image

DESCRIPTION = (
    "GLCM Energy: square root of ASM; energy/uniformity of co-occurrence."
)

from .glcm_contrast import _glcm


def glcm_energy(fg, bg=None, *, mask=None):
    name = "GLCM_ENERGY"
    arr = masked_image(fg, mask)
    P = _glcm(arr) if arr is not None else None
    if P is None:
        return name, float("nan")
    energy = np.sqrt(np.sum(P ** 2))
    return name, float(energy)
