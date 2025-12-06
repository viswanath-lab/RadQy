"""IQM package entry for modality-specific metrics."""

# Explicitly export MRI IQM helpers
from .mri import IQM_REGISTRY as MRI_IQM_REGISTRY, get_iqm_functions, get_iqm_names, get_iqm_registry  # noqa: F401
