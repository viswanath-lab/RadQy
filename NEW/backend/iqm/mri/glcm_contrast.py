import numpy as np

DESCRIPTION = (
    "GLCM Contrast: sum of squared gray-level differences weighted by co-occurrence; "
    "higher indicates more intensity variation."
)


def _glcm(arr, levels=32, offsets=((0, 1), (1, 0), (1, 1), (1, -1))):
    img = np.asarray(arr, dtype=float)
    if img.ndim < 2:
        return None
    img = img[..., 0] if img.ndim > 2 else img
    img = img[np.isfinite(img)]
    if img.size == 0:
        return None
    # reshape back?
    img = np.asarray(arr, dtype=float)
    img = img[..., 0] if img.ndim > 2 else img
    finite_mask = np.isfinite(img)
    if not finite_mask.any():
        return None
    img = img.copy()
    img[~finite_mask] = 0
    # quantize to [0, levels-1]
    minv, maxv = np.nanmin(img), np.nanmax(img)
    if not np.isfinite(minv) or not np.isfinite(maxv) or maxv == minv:
        return None
    q = np.clip(((img - minv) / (maxv - minv) * (levels - 1)).round().astype(int), 0, levels - 1)

    glcm = np.zeros((levels, levels), dtype=float)
    h, w = q.shape
    for dy, dx in offsets:
        y0 = max(0, -dy)
        y1 = h - max(0, dy)
        x0 = max(0, -dx)
        x1 = w - max(0, dx)
        a = q[y0:y1, x0:x1]
        b = q[y0 + dy:y1 + dy, x0 + dx:x1 + dx]
        np.add.at(glcm, (a, b), 1)
    total = glcm.sum()
    if total == 0:
        return None
    return glcm / total


def glcm_contrast(fg, bg=None):
    name = "GLCM_CONTRAST"
    P = _glcm(fg)
    if P is None:
        return name, float("nan")
    i = np.arange(P.shape[0])[:, None]
    j = np.arange(P.shape[1])[None, :]
    contrast = np.sum((i - j) ** 2 * P)
    return name, float(contrast)
