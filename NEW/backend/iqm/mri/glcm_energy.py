import numpy as np

DESCRIPTION = (
    "GLCM Energy: square root of ASM; energy/uniformity of co-occurrence."
)

from .glcm_contrast import _glcm


def glcm_energy(fg, bg=None):
    name = "GLCM_ENERGY"
    P = _glcm(fg)
    if P is None:
        return name, float("nan")
    energy = np.sqrt(np.sum(P ** 2))
    return name, float(energy)
