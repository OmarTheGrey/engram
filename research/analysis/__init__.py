"""The pre-registration's Statistics section, executable (docs/tasks/prereg-v1-plan.md, PR 2).

- `bootstrap`: the paired bootstrap of a mean difference with BCa and percentile
  intervals and the one-sided p-value, paired on item and seed.
- `equivalence`: H4's TOST, two one-sided score tests with a variance floor, and
  H4's one p-value, the intersection-union p over its pairs.
- `holm`: Holm's adjustment over the five primary p-values.
- `wilson`: Wilson score intervals for the Gate C table.
- `h1`: the H1 table from a results file whose schema it defines.

Tested on synthetic data with planted effects and nulls in research/tests/test_analysis.py
and research/tests/test_equivalence.py.
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
from analysis.equivalence import EquivalenceResult, intersection_union_p, tost
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
    "intersection_union_p",
    "item_means",
    "paired_bootstrap",
    "paired_differences",
    "paired_item_differences",
    "read_sessions",
    "resample_means",
    "tost",
    "wilson",
]
