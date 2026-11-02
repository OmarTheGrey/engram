"""H4's committed alpha-0.01 sizes hold the TOST's level at every Holm threshold (P2v4-1).

H4's one p-value (the intersection-union p, research/analysis/equivalence.py)
enters Holm over five hypotheses and may be compared with 0.05 / k for any k
from 1 to 5. research/results/h4-power.json checks the level at 0.05 and 0.01
only; research/scripts/h4_holm_levels.py records the largest level a search
over the composite null's boundary found (`composite_sup`) at every one of the
five thresholds for every distinct alpha-0.01 size that result commits. This
test reads the two committed results, so it is fast: it checks the record
covers exactly the committed table, and that every level is at most its
threshold. `make test-repro` reruns the search.
"""

from __future__ import annotations

import json

from scripts import h4_holm_levels
from scripts.results_io import REPO, sha256_file

POWER = REPO / "research/results/h4-power.json"
LEVELS = REPO / "research/results/h4-holm-levels.json"


def test_the_holm_thresholds_are_the_five_hypotheses_shares_of_alpha() -> None:
    assert h4_holm_levels.thresholds(0.05, 5) == [0.05, 0.025, 0.05 / 3, 0.0125, 0.01]


def test_the_record_covers_every_committed_alpha_0_01_size_of_the_current_power_table() -> None:
    record = json.loads(LEVELS.read_text(encoding="utf-8"))
    assert record["power_result"]["sha256"] == sha256_file(POWER)
    power = json.loads(POWER.read_text(encoding="utf-8"))
    committed = h4_holm_levels.committed_sizes(power, "0.01")
    assert [(s["items"], s["margin"]) for s in record["sizes"]] == committed
    assert len(committed) == 26


def test_every_committed_size_holds_its_level_at_every_holm_threshold() -> None:
    record = json.loads(LEVELS.read_text(encoding="utf-8"))
    ks = [str(k) for k in range(1, 6)]
    for size in record["sizes"]:
        assert sorted(size["levels"]) == ks
        for check in size["levels"].values():
            assert check["composite_sup"] <= check["threshold"], size
            assert check["holds"] is True
    assert record["all_hold"] is True
