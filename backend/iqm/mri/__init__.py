from typing import Callable, Dict, List, Tuple

from .mean import DESCRIPTION as MEAN_DESCRIPTION, mean
from .fail_fraction import DESCRIPTION as FAIL_DESCRIPTION, fail_fraction


IQM_REGISTRY: List[Dict[str, object]] = [
    {"name": "MEAN", "func": mean, "description": MEAN_DESCRIPTION},
    {"name": "FAIL_FRAC", "func": fail_fraction, "description": FAIL_DESCRIPTION},
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
