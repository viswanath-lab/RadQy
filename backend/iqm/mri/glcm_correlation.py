import numpy as np

DESCRIPTION = (
    "GLCM Correlation: linear dependency of gray levels across offsets; "
    "correlation of co-occurring intensities."
)

from .glcm_contrast import _glcm


def glcm_correlation(fg, bg=None):
    name = "GLCM_CORR"
    P = _glcm(fg)
    if P is None:
        return name, float("nan")

    i = np.arange(P.shape[0])
    j = np.arange(P.shape[1])
    pi = P.sum(axis=1)
    pj = P.sum(axis=0)
    mu_i = np.sum(i * pi)
    mu_j = np.sum(j * pj)
    sigma_i = np.sqrt(np.sum(pi * (i - mu_i) ** 2))
    sigma_j = np.sqrt(np.sum(pj * (j - mu_j) ** 2))
    denom = sigma_i * sigma_j
    if denom == 0 or not np.isfinite(denom):
        return name, float("nan")

    I, J = np.meshgrid(i, j, indexing="ij")
    corr = np.sum((I - mu_i) * (J - mu_j) * P) / denom
    return name, float(corr)
