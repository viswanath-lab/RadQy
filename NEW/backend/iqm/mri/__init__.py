from typing import Callable, Dict, List, Tuple
import numpy as np

from .mean import DESCRIPTION as MEAN_DESCRIPTION, mean
from .rng import DESCRIPTION as RNG_DESCRIPTION, rng
from .var import DESCRIPTION as VAR_DESCRIPTION, var
from .cv import DESCRIPTION as CV_DESCRIPTION, cv
from .cpp import DESCRIPTION as CPP_DESCRIPTION, cpp
from .psnr import DESCRIPTION as PSNR_DESCRIPTION, psnr
from .snr1 import DESCRIPTION as SNR1_DESCRIPTION, snr1
from .snr2 import DESCRIPTION as SNR2_DESCRIPTION, snr2
from .snr3 import DESCRIPTION as SNR3_DESCRIPTION, snr3
from .snr4 import DESCRIPTION as SNR4_DESCRIPTION, snr4
from .cnr import DESCRIPTION as CNR_DESCRIPTION, cnr
from .cvp import DESCRIPTION as CVP_DESCRIPTION, cvp
from .cjv import DESCRIPTION as CJV_DESCRIPTION, cjv
from .efc import DESCRIPTION as EFC_DESCRIPTION, efc
from .fber import DESCRIPTION as FBER_DESCRIPTION, fber
from .skw import DESCRIPTION as SKW_DESCRIPTION, skw
from .kurt import DESCRIPTION as KURT_DESCRIPTION, kurt
from .fail_fraction import DESCRIPTION as FAIL_DESCRIPTION, fail_fraction_from_metrics
from .freq_lfr import DESCRIPTION as LFR_DESCRIPTION, freq_lfr
from .freq_hfr import DESCRIPTION as HFR_DESCRIPTION, freq_hfr
from .freq_snrf import DESCRIPTION as SNRF_DESCRIPTION, freq_snrf
from .wavelet_wcs import DESCRIPTION as WCS_DESCRIPTION, wavelet_wcs
from .wavelet_wce import DESCRIPTION as WCE_DESCRIPTION, wavelet_wce
from .wavelet_wqs import DESCRIPTION as WQS_DESCRIPTION, wavelet_wqs
from .glcm_contrast import DESCRIPTION as GLCM_CONTRAST_DESCRIPTION, glcm_contrast
from .glcm_dissimilarity import DESCRIPTION as GLCM_DISS_DESCRIPTION, glcm_dissimilarity
from .glcm_asm import DESCRIPTION as GLCM_ASM_DESCRIPTION, glcm_asm
from .glcm_energy import DESCRIPTION as GLCM_ENERGY_DESCRIPTION, glcm_energy
from .glcm_homogeneity import DESCRIPTION as GLCM_HOMO_DESCRIPTION, glcm_homogeneity
from .glcm_correlation import DESCRIPTION as GLCM_CORR_DESCRIPTION, glcm_correlation


# Base per-slice IQMs
IQM_REGISTRY: List[Dict[str, object]] = [
    {"name": "MEAN", "func": mean, "description": MEAN_DESCRIPTION},
    {"name": "RNG", "func": rng, "description": RNG_DESCRIPTION},
    {"name": "VAR", "func": var, "description": VAR_DESCRIPTION},
    {"name": "CV",  "func": cv,  "description": CV_DESCRIPTION},
    {"name": "CPP", "func": cpp, "description": CPP_DESCRIPTION},
    {"name": "PSNR", "func": psnr, "description": PSNR_DESCRIPTION},
    {"name": "SNR1", "func": snr1, "description": SNR1_DESCRIPTION},
    {"name": "SNR2", "func": snr2, "description": SNR2_DESCRIPTION},
    {"name": "SNR3", "func": snr3, "description": SNR3_DESCRIPTION},
    {"name": "SNR4", "func": snr4, "description": SNR4_DESCRIPTION},
    {"name": "CNR", "func": cnr, "description": CNR_DESCRIPTION},
    {"name": "CVP", "func": cvp, "description": CVP_DESCRIPTION},
    {"name": "CJV", "func": cjv, "description": CJV_DESCRIPTION},
    {"name": "EFC", "func": efc, "description": EFC_DESCRIPTION},
    {"name": "FBER", "func": fber, "description": FBER_DESCRIPTION},
    {"name": "SKW", "func": skw, "description": SKW_DESCRIPTION},
    {"name": "KURT", "func": kurt, "description": KURT_DESCRIPTION},
    {"name": "LFR", "func": freq_lfr, "description": LFR_DESCRIPTION},
    {"name": "HFR", "func": freq_hfr, "description": HFR_DESCRIPTION},
    {"name": "SNRF", "func": freq_snrf, "description": SNRF_DESCRIPTION},
    {"name": "WCS", "func": wavelet_wcs, "description": WCS_DESCRIPTION},
    {"name": "WCE", "func": wavelet_wce, "description": WCE_DESCRIPTION},
    {"name": "WQS", "func": wavelet_wqs, "description": WQS_DESCRIPTION},
    {"name": "GLCM_CONTRAST", "func": glcm_contrast, "description": GLCM_CONTRAST_DESCRIPTION},
    {"name": "GLCM_DISS", "func": glcm_dissimilarity, "description": GLCM_DISS_DESCRIPTION},
    {"name": "GLCM_ASM", "func": glcm_asm, "description": GLCM_ASM_DESCRIPTION},
    {"name": "GLCM_ENERGY", "func": glcm_energy, "description": GLCM_ENERGY_DESCRIPTION},
    {"name": "GLCM_HOMOGENEITY", "func": glcm_homogeneity, "description": GLCM_HOMO_DESCRIPTION},
    {"name": "GLCM_CORR", "func": glcm_correlation, "description": GLCM_CORR_DESCRIPTION},
]


def get_iqm_registry() -> List[Dict[str, object]]:
    """Return IQM registry entries with name, func, and description."""
    return IQM_REGISTRY


def get_iqm_functions() -> List[Callable]:
    """Return IQM callables for processing."""
    return [entry["func"] for entry in IQM_REGISTRY]


def get_iqm_names() -> List[str]:
    """Return IQM metric names in registry order."""
    return [entry["name"] for entry in IQM_REGISTRY]


def compute_fail_fraction(metric_values: Dict[str, float], names: List[str]) -> Tuple[str, float]:
    """
    Compute FAIL_FRAC over aggregated IQM values for a participant.
    Considers provided metric names; returns ("FAIL_FRAC", count_non_finite_or_missing).
    """
    invalid = 0
    total = 0
    for name in names:
        total += 1
        val = metric_values.get(name, float("nan"))
        try:
            fval = float(val)
        except Exception:
            fval = float("nan")
        if not np.isfinite(fval):
            invalid += 1
    if total == 0:
        return "FAIL_FRAC", float("nan")
    return "FAIL_FRAC", int(invalid)
