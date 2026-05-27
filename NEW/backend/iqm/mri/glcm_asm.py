import numpy as np

DESCRIPTION = (
    "GLCM Angular Second Moment (ASM): energy of the co-occurrence matrix; "
    "higher indicates more uniform texture."
)

from .glcm_contrast import _glcm


def glcm_asm(fg, bg=None):
    name = "GLCM_ASM"
    P = _glcm(fg)
    if P is None:
        return name, float("nan")
    asm = np.sum(P ** 2)
    return name, float(asm)
