"""Holm's sequentially rejective procedure over the primary p-values (Holm 1979).

The pre-registration adjusts the five primary p-values (one per hypothesis)
at family-wise alpha 0.05; a hypothesis is supported when its adjusted value
is below 0.05 (docs/research/preregistration.md, Statistics). Adjusted values
in the standard form (docs/readings/litreview/methods-holm-1979.md): sort the
p-values, multiply the i-th smallest of m by m - i + 1, cap at one, and carry
the running maximum so the decisions match the step-down rule. Ties keep the
order of the hypotheses' names.
"""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass

from analysis.bootstrap import ALPHA


@dataclass(frozen=True)
class HolmResult:
    hypothesis: str
    p: float
    adjusted: float
    rejected: bool


def holm(pvalues: Mapping[str, float], alpha: float = ALPHA) -> dict[str, HolmResult]:
    """Holm-adjusted p-values and decisions, in the order the hypotheses were given."""
    if not pvalues:
        raise ValueError("Holm needs at least one p-value")
    for name, p in pvalues.items():
        if not 0.0 <= p <= 1.0:
            raise ValueError(f"p-value of {name} is {p}, outside [0, 1]")
    m = len(pvalues)
    ordered = sorted(pvalues.items(), key=lambda kv: (kv[1], kv[0]))
    adjusted: dict[str, float] = {}
    running = 0.0
    for i, (name, p) in enumerate(ordered):
        running = max(running, min(1.0, (m - i) * p))
        adjusted[name] = running
    return {
        name: HolmResult(name, p, adjusted[name], adjusted[name] < alpha)
        for name, p in pvalues.items()
    }
