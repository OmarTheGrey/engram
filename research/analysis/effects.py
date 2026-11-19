"""Effect sizes for H1's contrasts, beside the test (card X4; proposed, not registered).

The pre-registration's Statistics section names the test and its interval,
the paired mean difference with a BCa interval, and no other effect size.
Card X4 asks for effect sizes, so two are reported for every contrast a
minus b (C4 minus C5, C3 minus C5, C2 minus C5), proposed to the lead in
docs/log/2026-11-20-x4-effect-sizes.md:

- the absolute difference in violation rate: the contrast's `mean`, with its
  BCa interval, already in the table (`analysis.bootstrap.paired_bootstrap`);
  it is the primary effect size and is not computed again here;
- the relative reduction, (rate_a - rate_b) / rate_a: the share of a's
  violations that b removes, here `relative_reduction` with a percentile
  interval from a paired bootstrap of both rates.

Both rates are over the same pairs the contrast uses: an (item, seed) that
either condition excluded or lacks is dropped from both, each item's seeds
are averaged, and the rate is the mean over items. So rate_a - rate_b equals
the contrast's mean exactly, which the unpaired per-condition rates of the
table need not (Statistics, Rates).

The bootstrap resamples items, drawing each resample's counts of the
distinct (a, b) item pairs from one multinomial, as `resample_means` does
for one column: at most 16 distinct pairs with three seeds. A resample whose
rate_a is zero has no relative reduction; such resamples are counted
(`undefined_resamples`) and left out of the interval. When the observed
rate_a is zero, the relative reduction and its interval are null; when
every resample's is, only the interval is. Every
draw takes `seed` (AGENTS.md rule 6); it has no default.
"""

from __future__ import annotations

from collections.abc import Iterable
from typing import Any

import numpy as np

from analysis.bootstrap import CONFIDENCE, RESAMPLES, TOLERANCE, FloatArray, Session, item_means


def paired_rates(
    a: Iterable[Session], b: Iterable[Session]
) -> tuple[list[str], FloatArray, FloatArray]:
    """The items both conditions kept on a seed, and their seed-averaged outcomes under a and b.

    The pairing is `paired_item_differences`': only the (item, seed) both
    conditions kept enter, so the mean of a minus the mean of b is the
    contrast's mean difference.
    """
    first, second = list(a), list(b)
    kept = {(i, s) for i, s, o in first if o is not None} & {
        (i, s) for i, s, o in second if o is not None
    }
    mean_a = item_means((i, s, o) for i, s, o in first if (i, s) in kept)
    mean_b = item_means((i, s, o) for i, s, o in second if (i, s) in kept)
    items = sorted(mean_a)
    return (
        items,
        np.array([mean_a[i] for i in items], dtype=np.float64),
        np.array([mean_b[i] for i in items], dtype=np.float64),
    )


def relative_reduction(
    a: Iterable[Session],
    b: Iterable[Session],
    *,
    seed: int,
    resamples: int = RESAMPLES,
    confidence: float = CONFIDENCE,
) -> dict[str, Any]:
    """The relative reduction (rate_a - rate_b) / rate_a over the paired items, with interval."""
    items, x, y = paired_rates(a, b)
    if not items:
        raise ValueError("no item is kept under both conditions")
    rate_a, rate_b = float(x.mean()), float(y.mean())
    out: dict[str, Any] = {
        "measure": "relative reduction",
        "registered": False,
        "n": len(items),
        "rate_first": rate_a,
        "rate_second": rate_b,
        "difference": rate_a - rate_b,
        "relative_reduction": None,
        "low": None,
        "high": None,
        "interval": "percentile",
        "undefined_resamples": None,
        "resamples": resamples,
        "confidence": confidence,
    }
    if rate_a <= TOLERANCE:
        return out
    pairs, counts = np.unique(np.stack([x, y], axis=1), axis=0, return_counts=True)
    rng = np.random.default_rng(seed)
    draws = rng.multinomial(len(items), counts / len(items), size=resamples)
    star_a = (draws @ pairs[:, 0]) / len(items)
    star_b = (draws @ pairs[:, 1]) / len(items)
    defined = star_a > TOLERANCE
    out["relative_reduction"] = 1.0 - rate_b / rate_a
    out["undefined_resamples"] = int(resamples - np.count_nonzero(defined))
    if defined.any():
        ratios = 1.0 - star_b[defined] / star_a[defined]
        tail = (1.0 - confidence) / 2.0
        low, high = np.quantile(ratios, [tail, 1.0 - tail])
        out["low"], out["high"] = float(low), float(high)
    return out
