import numpy as np
from scipy.ndimage import median_filter, minimum_filter

from ._spatial import masked_image

DESCRIPTION = (
    "PSNR surrogate (dB) against a 5x5 median-filtered version of the same 2D "
    "slice, evaluated at finite foreground pixels; peak is the maximum absolute "
    "foreground intensity. Higher indicates less residual variation, not necessarily "
    "better diagnostic quality. Undefined for empty foreground or zero residual error."
)


def psnr(fg, bg=None, *, mask=None):
    """Compare spatially aligned pixels to a smoothed reference.

    ``fg`` must be the original 2D slice; ``mask`` selects evaluation pixels.
    ``bg`` is retained for call compatibility and is not a reference image.
    Neighborhoods containing nonfinite pixels are excluded. A perfect match
    has infinite theoretical PSNR and is returned as NaN under the pipeline's
    finite-only aggregation convention.
    """
    name = "PSNR"
    selected = masked_image(fg, mask)
    if selected is None:
        return name, float("nan")

    image = np.asarray(fg, dtype=float)
    finite = np.isfinite(image)
    # Reflect boundaries instead of introducing the zero padding of medfilt2d.
    reference = median_filter(np.where(finite, image, 0.0), size=5, mode="reflect")
    valid = np.isfinite(selected)
    valid &= minimum_filter(finite.astype(np.uint8), size=5, mode="reflect").astype(bool)
    if not valid.any():
        return name, float("nan")

    peak = float(np.max(np.abs(image[valid])))
    if peak == 0 or not np.isfinite(peak):
        return name, float("nan")
    # Normalize first to avoid overflow when squaring large intensities.
    residual = image[valid] / peak - reference[valid] / peak
    mse = float(np.mean(residual ** 2))
    if not np.isfinite(mse) or mse <= 0:
        return name, float("nan")
    return name, float(-10.0 * np.log10(mse))
