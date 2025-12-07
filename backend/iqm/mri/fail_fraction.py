DESCRIPTION = (
    "Count of non-finite IQM values (NaN/inf) across computed metrics per participant; "
    "higher values flag poor FG/BG or noisy slices."
)


def fail_fraction_from_metrics(metric_values: dict, metric_names: list[str]):
    """
    Participant-level FAIL_FRAC: count of IQMs that are non-finite.

    Parameters
    ----------
    metric_values : dict
        Mapping of metric name -> aggregated value for a participant.
    metric_names : list[str]
        Names of IQMs to include in the calculation (excluding FAIL_FRAC itself).

    Returns
    -------
    name : str
        "FAIL_FRAC"
    measure : int or float
        Count of IQMs that are NaN/inf/non-finite, or NaN if undefined.
    """
    name = "FAIL_FRAC"
    total = len(metric_names)
    if total == 0:
        return name, float("nan")

    invalid = 0
    for n in metric_names:
        val = metric_values.get(n, float("nan"))
        try:
            v = float(val)
        except Exception:
            v = float("nan")
        if not np.isfinite(v):
            invalid += 1

    return name, int(invalid)
