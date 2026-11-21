"""Card L5: research/scripts/near_duplicate.py's counting, on rows built by hand (no node)."""

from __future__ import annotations

from typing import Any

from scripts.near_duplicate import agreement, labelled, oracle_estimate


def test_the_oracle_estimates_identical_sets_as_one_and_disjoint_ones_near_zero() -> None:
    a = [f"s{i}" for i in range(40)]
    assert oracle_estimate(a, list(reversed(a)), 128, 1) == 1.0
    assert oracle_estimate(a, [f"t{i}" for i in range(40)], 128, 1) < 0.05


def test_the_oracle_is_close_to_the_exact_similarity() -> None:
    a = [f"s{i}" for i in range(100)]
    b = [f"s{i}" for i in range(20, 120)]  # Jaccard 80 / 120
    assert abs(oracle_estimate(a, b, 128, 1) - 80 / 120) < 0.15


def test_agreement_counts_pairs_on_the_same_side_of_each_threshold() -> None:
    pairs = [
        {"estimate": 0.9, "oracle": 0.88, "jaccard": 0.86},
        {"estimate": 0.84, "oracle": 0.86, "jaccard": 0.85},
        {"estimate": 0.2, "oracle": 0.25, "jaccard": 0.22},
    ]
    out = agreement(pairs, [0.85], 0.95)
    at = out["by_threshold"]["0.85"]
    assert at["tier_vs_oracle"]["count"] == 2
    assert at["oracle_vs_exact"]["count"] == 3
    assert at["tier_vs_exact"]["count"] == 2
    assert at["exact_at_or_above"] == 2
    assert out["pairs"] == 3
    assert abs(out["mean_absolute_difference"]["tier_vs_oracle"] - (0.02 + 0.02 + 0.05) / 3) < 1e-12


def test_labelled_scores_only_the_tiers_own_fixtures_item_by_item() -> None:
    rows: list[dict[str, Any]] = [
        {
            "labelled_flags": ["b", "d"],
            "flagged": [{"item": "b", "of": "a"}, {"item": "e", "of": "a"}],
        },
        {"labelled_flags": [], "flagged": []},
        {"labelled_flags": None, "flagged": [{"item": "x", "of": "y"}]},
    ]
    out = labelled(rows, 0.95)
    assert (out["true_positives"], out["false_positives"], out["false_negatives"]) == (1, 1, 1)
    assert out["precision"]["rate"] == 0.5
    assert out["recall"]["rate"] == 0.5
