from typing import Callable, Dict, List, Tuple
import numpy as np

from .mean import DESCRIPTION as MEAN_DESCRIPTION, mean
from .rng import DESCRIPTION as RNG_DESCRIPTION, rng
from .var import DESCRIPTION as VAR_DESCRIPTION, var
from .cv import DESCRIPTION as CV_DESCRIPTION, cv
from .cpp import DESCRIPTION as CPP_DESCRIPTION, cpp
from .fail_fraction import DESCRIPTION as FAIL_DESCRIPTION, fail_fraction_from_metrics


# Base per-slice IQMs
IQM_REGISTRY: List[Dict[str, object]] = [
    {"name": "MEAN", "func": mean, "description": MEAN_DESCRIPTION},
    {"name": "RNG", "func": rng, "description": RNG_DESCRIPTION},
    {"name": "VAR", "func": var, "description": VAR_DESCRIPTION},
    {"name": "CV",  "func": cv,  "description": CV_DESCRIPTION},
    {"name": "CPP", "func": cpp, "description": CPP_DESCRIPTION},
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
