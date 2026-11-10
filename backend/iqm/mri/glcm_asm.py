import numpy as np
from ._spatial import masked_image

DESCRIPTION = (
    "GLCM Angular Second Moment (ASM): energy of the co-occurrence matrix; "
    "higher indicates more uniform texture."
)

from .glcm_contrast import _glcm


def glcm_asm(fg, bg=None, *, mask=None):
    name = "GLCM_ASM"
    arr = masked_image(fg, mask)
    P = _glcm(arr) if arr is not None else None
    if P is None:
        return name, float("nan")
    asm = np.sum(P ** 2)
    return name, float(asm)
