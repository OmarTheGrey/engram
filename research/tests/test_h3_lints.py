"""Card L4's lint precision and recall: the scoring, the floor and the model-based delta.

The scoring tests feed scripts/lint_scores.py planted labels and findings
whose precision, recall, unverified counts and bounds are worked out here by
hand. The floor's parts run on the fixture-size set (fixtures/fault-sets/
longmemeval) through the same TypeScript entry point the full run uses; the
full set is `make test-repro`'s. The delta runs end to end on the pipeline
config (research/configs/h3-lint-delta-fixture.json): it replays the scripted
lint model's committed cassettes offline with zero new calls, and the planted
answers of packages/runner/scripts/fault-set-script.ts come out as listed
there. Those numbers prove the pipeline and are not results; nothing here is
written under research/results.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

import pytest

from scripts import h3_lint_delta, h3_lint_floor, lint_scores
from scripts.results_io import REPO, load_config

SET = REPO / "fixtures" / "fault-sets" / "longmemeval"
FLOOR_CONFIG = REPO / "research" / "configs" / "h3-lint-floor.json"
DELTA_CONFIG = REPO / "research" / "configs" / "h3-lint-delta.json"
DELTA_FIXTURE = REPO / "research" / "configs" / "h3-lint-delta-fixture.json"


def label(
    q: str,
    item: str,
    kind: str,
    subtype: str,
    cls: str,
    keyed: bool,
    det: list[str] | None = None,
    model: list[str] | None = None,
    finding_on: str | None = None,
    related: list[str] | None = None,
    variant: str | None = None,
) -> dict[str, Any]:
    lints = {"deterministic": det or [], "model": model or []}
    none: dict[str, list[str]] = {"deterministic": [], "model": []}
    return {
        "question_id": q,
        "item_id": item,
        "kind": kind,
        "class": cls,
        "subtype": subtype,
        "keyed": keyed,
        "expected": lints if kind == "fault" else none,
        "near_miss_of": lints if kind == "near-miss" else none,
        "related": related or [],
        "finding_on": finding_on or item,
        "variant": variant,
    }


def finding(
    item: str, lint: str, tier: str = "deterministic", base: bool = False
) -> dict[str, Any]:
    return {"tier": tier, "lint_id": lint, "item_id": item, "base": base}


LABELS = [
    label("q", "f1", "fault", "expired-validity", "stale", True, det=["expired-validity"]),
    label("q", "n1", "near-miss", "expired-validity", "stale", True, det=["expired-validity"]),
    label("q", "f2", "fault", "orphan", "unsupported", True, det=["orphan"]),
    label("q", "n2", "near-miss", "orphan", "unsupported", True, det=["orphan"]),
    label(
        "q",
        "f3",
        "fault",
        "superseded",
        "stale",
        False,
        model=["contradiction"],
        finding_on="l3",
        related=["l3"],
    ),
    label(
        "q",
        "n3",
        "near-miss",
        "superseded",
        "stale",
        False,
        model=["contradiction"],
        finding_on="l4",
        related=["l4"],
    ),
]
FINDINGS = [
    finding("f1", "expired-validity"),
    finding("n2", "orphan"),
    finding("b1", "duplicate", base=True),
    finding("b2", "duplicate", base=True),
    finding("x", "expired-validity"),
    finding("l3", "contradiction", "model"),
    finding("f2", "contradiction", "model"),
]


def scored(tiers: list[str]) -> dict[str, Any]:
    flags, base = lint_scores.flags_of(FINDINGS)
    return lint_scores.tier_scores({"q": LABELS}, {"q": flags}, {"q": base}, tiers)


def test_a_tier_flags_a_label_on_its_finding_on_and_scores_recall_and_labelled_precision() -> None:
    det = scored(["deterministic"])
    stale = det["by_class"]["stale"]
    assert (stale["keyed"]["tp"], stale["keyed"]["faults"], stale["keyed"]["fp"]) == (1, 1, 0)
    assert stale["unkeyed"]["recall"]["value"] == 0.0
    unsupported = det["by_class"]["unsupported"]["keyed"]
    assert (unsupported["tp"], unsupported["fp"]) == (0, 1)
    assert unsupported["precision"]["value"] == 0.0
    overall = det["overall"]["all"]
    assert (overall["tp"], overall["fp"], overall["faults"]) == (1, 1, 3)
    assert overall["recall"]["value"] == pytest.approx(1 / 3)
    lo, hi = overall["recall"]["ci"]
    assert 0 < lo < 1 / 3 < hi < 1
    assert det["unverified"] == {"base": 2, "injected": 1}
    assert det["precision_with_unverified"] == {"unverified": 3, "lower": 0.2, "upper": 0.8}


def test_both_tiers_flag_what_either_does_and_the_superseded_finding_lands_on_the_later_item() -> (
    None
):
    both = scored(["deterministic", "model"])
    assert both["by_subtype"]["superseded"]["tp"] == 1
    assert both["by_subtype"]["orphan"]["tp"] == 1
    assert both["overall"]["all"]["tp"] == 3
    model = scored(["model"])
    assert model["unverified"] == {"base": 0, "injected": 0}


def test_per_lint_scores_count_only_its_own_labels_and_say_where_else_it_flagged() -> None:
    flags, base = lint_scores.flags_of(FINDINGS)
    det = lint_scores.lint_scores(
        {"q": LABELS},
        {"q": flags},
        {"q": base},
        "deterministic",
        ["duplicate", "expired-validity", "orphan"],
    )
    assert det["expired-validity"]["tp"] == 1 and det["expired-validity"]["fp"] == 0
    assert det["expired-validity"]["elsewhere"] == {
        "other_labels": 0,
        "unlabelled_injected": 1,
        "base": 0,
    }
    assert det["duplicate"]["elsewhere"]["base"] == 2
    assert det["duplicate"]["precision"]["value"] is None
    model = lint_scores.lint_scores(
        {"q": LABELS}, {"q": flags}, {"q": base}, "model", ["contradiction"]
    )
    assert model["contradiction"]["tp"] == 1
    assert model["contradiction"]["elsewhere"]["other_labels"] == 1


def test_seed_averaged_flags_give_a_fractional_recall_with_a_wilson_interval() -> None:
    rows = [(la, share) for la, share in zip(LABELS[:2], (0.5, 0.0), strict=True)]
    g = lint_scores.groups(rows)
    cell = g["by_subtype"]["expired-validity"]
    assert cell["recall"]["value"] == 0.5 and cell["recall"]["ci"] is not None
    assert cell["precision"]["value"] == 1.0 and cell["precision"]["ci"] is None


def test_the_unit_of_a_pair_is_sorted_and_of_a_claim_is_its_item() -> None:
    assert lint_scores.label_unit(LABELS[4], "contradiction") == "contradiction:f3+l3"
    assert lint_scores.label_unit(LABELS[0], "unsupported-claim") == "unsupported-claim:f1"


# The floor.


def test_the_floor_config_names_card_l2s_set_and_the_live_model_run() -> None:
    config = load_config(FLOOR_CONFIG)
    assert config["fault_set"] == {
        "config": "research/configs/h3-fault-set.json",
        "result": "research/results/h3-fault-set.json",
    }
    runner = load_config(REPO / config["model_run"])
    assert runner["kind"] == "experiment" and runner["seeds"] == [1, 2, 3]
    assert runner["questions"] == "all"


def test_the_floor_on_the_fixture_set_flags_every_keyed_fault_and_nothing_else() -> None:
    rows = h3_lint_floor.lint_set(SET, 20)
    labels = lint_scores.by_question(lint_scores.read_jsonl(SET / "labels.jsonl"))
    flags: dict[str, Any] = {}
    base: dict[str, set[str]] = {}
    for r in rows:
        flags[r["question_id"]], base[r["question_id"]] = lint_scores.flags_of(r["findings"])
    s = lint_scores.tier_scores(labels, flags, base, ["deterministic"])
    assert (s["overall"]["keyed"]["tp"], s["overall"]["keyed"]["faults"]) == (100, 100)
    assert s["overall"]["unkeyed"]["tp"] == 0 and s["overall"]["all"]["fp"] == 0
    assert s["unverified"] == {"base": 0, "injected": 0}
    runner = {"model": "prereg/M1", "seeds": [1, 2, 3]}
    run = h3_lint_floor.model_run(rows, labels, runner, "x.json")
    assert run["per_seed"] == sum(len(r["planned"]) for r in rows)
    assert run["calls"] == 3 * run["per_seed"]
    for lint in ("contradiction", "unsupported-claim"):
        assert run["labelled_units"][lint]["planned"] == run["labelled_units"][lint]["labels"]


def test_the_floor_fails_when_it_disagrees_with_card_l2s_label_check() -> None:
    s = scored(["deterministic"])
    check = {
        "keyed_faults": 2,
        "keyed_faults_flagged": 1,
        "near_misses_flagged": 1,
        "unlabelled_findings_on_base_items": {"duplicate": 2},
    }
    h3_lint_floor.check_against_l2(s, check)
    with pytest.raises(ValueError, match="near-misses"):
        h3_lint_floor.check_against_l2(s, {**check, "near_misses_flagged": 0})
    with pytest.raises(ValueError, match="base items"):
        h3_lint_floor.check_against_l2(s, {**check, "unlabelled_findings_on_base_items": {}})


def test_the_floor_says_what_holds_by_construction() -> None:
    text = " ".join(
        h3_lint_floor.by_construction(scored(["deterministic"]))["holds_by_construction"]
    )
    assert "regression check" in text and "wrong-scope" in text


def test_a_set_that_differs_from_card_l2s_hashes_is_not_current(tmp_path: Path) -> None:
    for name in h3_lint_floor.CHECKED:
        (tmp_path / name).write_text("x", encoding="utf-8")
    assert not h3_lint_floor.set_is_current(tmp_path, dict.fromkeys(h3_lint_floor.CHECKED, "0"))


# The model-based delta.


@pytest.fixture(scope="module")
def fixture_delta() -> dict[str, Any]:
    return h3_lint_delta.build(load_config(DELTA_FIXTURE))


def cells(result: dict[str, Any], seed: str, tier: str, cls: str, key: str) -> tuple[Any, ...]:
    c = result["per_seed"][seed][tier]["by_class"][cls][key]
    return (c["tp"], c["faults"], c["fp"])


def test_the_fixture_replay_makes_no_new_call_and_is_scripted(
    fixture_delta: dict[str, Any],
) -> None:
    assert fixture_delta["calls"] == {"cached": 250, "new": 0}
    assert fixture_delta["scripted"] is True
    assert (fixture_delta["questions"], fixture_delta["labels"]) == (2, 36)


def test_seed_1_misses_both_supersessions_and_plants_one_unverified_finding(
    fixture_delta: dict[str, Any],
) -> None:
    assert cells(fixture_delta, "1", "deterministic", "stale", "all") == (4, 6, 0)
    assert cells(fixture_delta, "1", "both", "stale", "unkeyed") == (0, 2, 0)
    assert cells(fixture_delta, "1", "both", "contradictory", "unkeyed") == (2, 2, 0)
    assert cells(fixture_delta, "1", "both", "unsupported", "all") == (6, 6, 0)
    assert fixture_delta["per_seed"]["1"]["model"]["unverified"] == {"base": 0, "injected": 1}
    delta = fixture_delta["per_seed"]["1"]["delta"]["by_class"]
    assert delta["stale"]["all"]["recall"] == 0.0
    assert delta["unsupported"]["all"]["recall"] == pytest.approx(1 / 3)


def test_seed_2_finds_them_but_flags_both_conflict_near_misses_and_loses_two_units(
    fixture_delta: dict[str, Any],
) -> None:
    assert cells(fixture_delta, "2", "both", "stale", "unkeyed") == (2, 2, 0)
    assert cells(fixture_delta, "2", "both", "contradictory", "unkeyed") == (1, 2, 2)
    assert cells(fixture_delta, "2", "both", "unsupported", "unkeyed") == (1, 2, 0)
    units = fixture_delta["per_seed"]["2"]["units"]
    assert units["labelled"]["conflict"]["fault"]["malformed"] == 1
    assert units["labelled"]["conflict"]["near-miss"]["flag"] == 2
    assert units["unlabelled"]["unsupported-claim"]["refused"] == 1
    delta = fixture_delta["per_seed"]["2"]["delta"]["by_class"]["stale"]["all"]
    assert delta["recall"] == pytest.approx(1 / 3)


def test_across_seeds_averages_each_label_then_gives_the_spread(
    fixture_delta: dict[str, Any],
) -> None:
    across = fixture_delta["across_seeds"]
    conflict = across["seed_averaged"]["both"]["by_class"]["contradictory"]["unkeyed"]
    assert conflict["recall"]["value"] == 0.75 and conflict["recall"]["ci"] is not None
    spread = across["delta_spread"]["by_class"]["stale"]["all"]["recall"]
    assert spread["n"] == 2 and spread["mean"] == pytest.approx(1 / 6)
    assert spread["min"] == 0.0 and spread["max"] == pytest.approx(1 / 3)


def test_a_scripted_run_is_never_written_under_research_results(tmp_path: Path) -> None:
    out = REPO / "research" / "results" / "h3-lint-delta-fixture.json"
    with pytest.raises(SystemExit, match="not results"):
        h3_lint_delta.main(["--config", str(DELTA_FIXTURE), "--out", str(out)])
    assert not out.exists()


def test_the_live_delta_refuses_until_its_model_is_named() -> None:
    config = load_config(DELTA_CONFIG)
    assert config["model"] is None
    assert config["fault_set_result"] == "research/results/h3-fault-set.json"
    with pytest.raises(SystemExit, match="set `model`"):
        h3_lint_delta.build(config)


def test_the_audit_is_unjudged_until_a_config_names_a_judged_sheet() -> None:
    assert load_config(FLOOR_CONFIG)["audit_sheet"] is None
    assert h3_lint_floor.audit_status(None).startswith("unjudged")
    with pytest.raises(NotImplementedError):
        h3_lint_floor.audit_status("sheet.csv")
