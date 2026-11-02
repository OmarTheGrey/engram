"""The pre-registration's Statistics section, executable (docs/tasks/prereg-v1-plan.md, PR 2).

- `bootstrap`: the paired bootstrap of a mean difference with BCa and percentile
  intervals and the one-sided p-value, paired on item and seed.
- `equivalence`: H4's TOST, two one-sided score tests with a variance floor.
- `holm`: Holm's adjustment over the five primary p-values.
- `wilson`: Wilson score intervals for the Gate C table.
- `h1`: the H1 table from a results file whose schema it defines.

Tested on synthetic data with planted effects and nulls in research/tests/test_analysis.py.
"""

from analysis.bootstrap import (
    ALPHA,
    CONFIDENCE,
    RESAMPLES,
    BootstrapResult,
    acceleration,
    bca_interval,
    item_means,
    paired_bootstrap,
    paired_differences,
    paired_item_differences,
    resample_means,
)
from analysis.equivalence import EquivalenceResult, tost
from analysis.h1 import H1Config, SchemaError, build_h1_table, decide_h1, read_sessions
from analysis.holm import HolmResult, holm
from analysis.wilson import wilson

__all__ = [
    "ALPHA",
    "CONFIDENCE",
    "RESAMPLES",
    "BootstrapResult",
    "EquivalenceResult",
    "H1Config",
    "HolmResult",
    "SchemaError",
    "acceleration",
    "bca_interval",
    "build_h1_table",
    "decide_h1",
    "holm",
    "item_means",
    "paired_bootstrap",
    "paired_differences",
    "paired_item_differences",
    "read_sessions",
    "resample_means",
    "tost",
    "wilson",
]
