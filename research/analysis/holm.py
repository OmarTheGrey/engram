"""Holm's sequentially rejective procedure over the primary p-values (Holm 1979).

The pre-registration adjusts the five primary p-values (one per hypothesis)
at family-wise alpha 0.05; a hypothesis is supported when its adjusted value
is below 0.05 (docs/research/preregistration.md, Statistics). Adjusted values
in the standard form (docs/readings/litreview/methods-holm-1979.md): sort the
p-values, multiply the i-th smallest of m by m - i + 1, cap at one, and carry
the running maximum so the decisions match the step-down rule. Ties keep the
order of the hypotheses' names.

The registered family (finding RV-DES-12). `holm` adjusts over exactly the
five registered hypotheses, `HYPOTHESES`, and refuses any other set of
names: before this guard it took m from the p-values it was given, so a
hypothesis that was not run silently lowered every other adjustment. A
hypothesis with no p-value is refused too, never filled in: a caller that
means "not run counts as p = 1" passes 1.0 for it explicitly, a rule the
lead has yet to register (docs/log/2026-11-20-x4-holm-not-run-rule.md).
`interim_bound` is H1's read-out before the other four exist, the m p
bound of the same family, so the bound and the final adjustment use one m
and can never disagree about it. `step_down` is the procedure over any
family, for checking the arithmetic against the reading note's examples; no
decision goes through it.
"""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass

from analysis.bootstrap import ALPHA

HYPOTHESES = ("H1", "H2", "H3", "H4", "H5")
"""The registered family: one primary p-value per hypothesis (pre-registration, Statistics)."""


@dataclass(frozen=True)
class HolmResult:
    hypothesis: str
    p: float
    adjusted: float
    rejected: bool


def step_down(pvalues: Mapping[str, float], alpha: float = ALPHA) -> dict[str, HolmResult]:
    """Holm's adjustment over whatever family it is given; decisions use `holm`."""
    if not pvalues:
        raise ValueError("Holm needs at least one p-value")
    for name, p in pvalues.items():
        if isinstance(p, bool) or not isinstance(p, int | float):
            raise ValueError(f"p-value of {name} is {p!r}, not a number")
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


def holm(pvalues: Mapping[str, float | None], alpha: float = ALPHA) -> dict[str, HolmResult]:
    """Holm-adjusted p-values and decisions over the registered family, in the order given.

    Refuses unless `pvalues` names exactly H1 to H5, each with a p-value: a
    hypothesis that was not run is passed explicitly by the caller (see the
    module docstring), never dropped.
    """
    names = set(pvalues)
    missing = [h for h in HYPOTHESES if h not in names]
    unknown = sorted(names - set(HYPOTHESES))
    if missing or unknown:
        raise ValueError(
            f"Holm adjusts over exactly {list(HYPOTHESES)}: missing {missing}, unknown {unknown}; "
            "a hypothesis not run must be passed explicitly"
        )
    absent = [h for h in HYPOTHESES if pvalues[h] is None]
    if absent:
        raise ValueError(
            f"{absent} have no p-value; pass each explicitly (a not-run rule such as p = 1 "
            "is the lead's to register, not Holm's to assume)"
        )
    given = {h: p for h, p in pvalues.items() if p is not None}
    return step_down(given, alpha)


def interim_bound(p: float) -> float:
    """H1's Holm-adjusted value before the others exist lies in [p, m p]; the upper end, capped.

    m is the registered family's size, the m `holm` adjusts over, so the
    interim read-out and the final adjustment agree (finding RV-DES-12).
    """
    if not 0.0 <= p <= 1.0:
        raise ValueError(f"p-value {p} outside [0, 1]")
    return min(1.0, len(HYPOTHESES) * p)
