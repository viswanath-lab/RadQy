import numpy as np
from ._spatial import masked_image

DESCRIPTION = (
    "GLCM Contrast: sum of squared gray-level differences weighted by co-occurrence; "
    "higher indicates more intensity variation."
)


def _glcm(arr, levels=32, offsets=((0, 1), (1, 0), (1, 1), (1, -1))):
    img = masked_image(arr)
    if img is None:
        return None
    finite_mask = np.isfinite(img)
    values = img[finite_mask]
    minv, maxv = values.min(), values.max()
    if maxv == minv:
        return None
    q = np.zeros(img.shape, dtype=int)
    q[finite_mask] = np.clip(
        ((values - minv) / (maxv - minv) * (levels - 1)).round().astype(int),
        0, levels - 1,
    )

    glcm = np.zeros((levels, levels), dtype=float)
    h, w = q.shape
    for dy, dx in offsets:
        y0 = max(0, -dy)
        y1 = h - max(0, dy)
        x0 = max(0, -dx)
        x1 = w - max(0, dx)
        a = q[y0:y1, x0:x1]
        b = q[y0 + dy:y1 + dy, x0 + dx:x1 + dx]
        valid = (finite_mask[y0:y1, x0:x1] &
                 finite_mask[y0 + dy:y1 + dy, x0 + dx:x1 + dx])
        np.add.at(glcm, (a[valid], b[valid]), 1)
    total = glcm.sum()
    if total == 0:
        return None
    return glcm / total


def glcm_contrast(fg, bg=None, *, mask=None):
    name = "GLCM_CONTRAST"
    arr = masked_image(fg, mask)
    P = _glcm(arr) if arr is not None else None
    if P is None:
        return name, float("nan")
    i = np.arange(P.shape[0])[:, None]
    j = np.arange(P.shape[1])[None, :]
    contrast = np.sum((i - j) ** 2 * P)
    return name, float(contrast)
