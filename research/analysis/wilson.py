"""Wilson score intervals for the Gate C table's rates (plan decision 3).

Wilson 1927, in the form Newcombe 1998 calls method 3 (score interval without
continuity correction): it stays inside [0, 1] and keeps its coverage near
zero, where violation rates under enforcement are expected to sit.
`successes` may be fractional: the table's rate is a mean of seed-averaged
item outcomes, and its n is the number of items (the unit of analysis).
"""

from __future__ import annotations

import math
from statistics import NormalDist

from analysis.bootstrap import CONFIDENCE


def wilson(successes: float, n: int, confidence: float = CONFIDENCE) -> tuple[float, float]:
    """The Wilson score interval for a proportion `successes` / `n`."""
    if n < 1:
        raise ValueError("a Wilson interval needs n of at least 1")
    if not 0.0 <= successes <= n:
        raise ValueError(f"successes {successes} outside [0, {n}]")
    z = NormalDist().inv_cdf(1.0 - (1.0 - confidence) / 2.0)
    p = successes / n
    z2n = z * z / n
    centre = (p + z2n / 2.0) / (1.0 + z2n)
    half = z * math.sqrt(p * (1.0 - p) / n + z2n / (4.0 * n)) / (1.0 + z2n)
    return max(0.0, centre - half), min(1.0, centre + half)
