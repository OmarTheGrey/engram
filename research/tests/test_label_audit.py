"""The label-audit kit (docs/tasks/prereg-v1-plan.md, decision 9; PR 4, part A, deliverable 6).

The sampler draws a seeded sample per H1 benchmark into sheets two members
fill in locally; the agreement script turns two filled sheets into the
disagreement rate and Cohen's kappa. These tests use planted checkpoints and
two synthetic filled sheets; the vendored MEM-INV-Bench cases are in the
repository, so its sample is drawn for real.
"""

from __future__ import annotations

import csv
from pathlib import Path
from typing import Any

import pytest

from scripts import label_audit_agreement as agreement
from scripts import label_audit_sample as sample
from scripts.results_io import REPO


def planted_checkpoints() -> list[dict[str, Any]]:
    out = []
    for kind, n in (("privacy", 40), ("safety", 30), ("utility", 20)):
        for i in range(n):
            out.append(
                {
                    "checkpoint_id": f"{kind}_ckpt_{i:02d}",
                    "episode_id": f"ep_{i % 3}",
                    "domain": "office",
                    "query_type": kind,
                }
            )
    return out


def test_the_gatemem_sample_is_seeded_and_drawn_per_violation_kind() -> None:
    first = sample.sample_per_kind(planted_checkpoints(), per_kind=25, seed=7)
    again = sample.sample_per_kind(planted_checkpoints(), per_kind=25, seed=7)
    other = sample.sample_per_kind(planted_checkpoints(), per_kind=25, seed=8)
    assert first == again
    assert first != other
    kinds = [c["query_type"] for c in first]
    assert kinds.count("privacy") == 25 and kinds.count("safety") == 25
    assert "utility" not in kinds
    assert len({c["checkpoint_id"] for c in first}) == 50


def test_a_kind_with_fewer_items_than_asked_is_taken_whole() -> None:
    few = [
        c
        for c in planted_checkpoints()
        if c["query_type"] != "safety" or c["checkpoint_id"] < "safety_ckpt_10"
    ]
    drawn = sample.sample_per_kind(few, per_kind=25, seed=7)
    assert [c["query_type"] for c in drawn].count("safety") == 10


def test_every_mem_inv_case_is_in_its_sample_with_its_label(tmp_path: Path) -> None:
    config = {
        "seed": 20261103,
        "members": ["first", "second"],
        "gatemem": None,
        "mem-inv-bench": {
            "fixtures": "fixtures/bench/mem-inv-bench",
            "cases": "full/cases.jsonl",
            "per_benchmark": 50,
        },
    }
    written = sample.write_kit(config, tmp_path)
    assert sorted(p.name for p in written) == [
        "mem-inv-bench-first.csv",
        "mem-inv-bench-second.csv",
    ]
    rows = list(csv.DictReader((tmp_path / "mem-inv-bench-first.csv").open(encoding="utf-8")))
    assert len(rows) == 38
    assert {r["benchmark_label"] for r in rows} == {"attack", "legit"}
    assert all(r["member_label"] == "" for r in rows)
    first = rows[0]
    assert (tmp_path / first["context"]).read_text(encoding="utf-8").startswith("# ")
    # A second draw refuses to overwrite sheets a member may have filled.
    with pytest.raises(FileExistsError):
        sample.write_kit(config, tmp_path)


def test_sheets_are_written_only_under_engram_or_outside_the_repository(tmp_path: Path) -> None:
    sample.check_out_dir(REPO / ".engram" / "audit")
    sample.check_out_dir(tmp_path)
    with pytest.raises(ValueError, match="not under"):
        sample.check_out_dir(REPO / "research" / "audit")


# The agreement script, on two synthetic filled sheets.

HEADER = list(sample.COLUMNS)


def filled(path: Path, labels: list[str], targets: list[str]) -> None:
    with path.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=HEADER)
        w.writeheader()
        for i, (label, ok) in enumerate(zip(labels, targets, strict=True)):
            w.writerow(
                {
                    "benchmark": "gatemem",
                    "item": f"gatemem/ckpt_{i:02d}",
                    "kind": "access control",
                    "what": "q",
                    "benchmark_label": "refuse" if i < 5 else "answer_redacted",
                    "benchmark_targets": "x",
                    "context": "context/gatemem/01.md",
                    "member_label": label,
                    "member_targets_ok": ok,
                    "member_comment": "",
                }
            )


def test_two_filled_sheets_give_the_disagreement_rate_and_kappa(tmp_path: Path) -> None:
    r, a = "refuse", "answer_redacted"
    filled(tmp_path / "gatemem-first.csv", [r] * 5 + [a] * 5, ["yes"] * 10)
    filled(tmp_path / "gatemem-second.csv", [r] * 4 + [a] * 5 + [r], ["yes"] * 9 + ["no"])
    out = agreement.compare_dir(tmp_path, ["first", "second"])
    g = out["gatemem"]
    assert g["items"] == 10
    # Members: 8 of 10 agree, chance agreement 0.5, so kappa (0.8 - 0.5) / 0.5.
    assert g["label"]["between_members"] == {
        "disagreements": 2,
        "rate": 0.2,
        "kappa": pytest.approx(0.6),
    }
    assert g["label"]["against_benchmark"] == {
        "first": {"disagreements": 0, "rate": 0.0},
        "second": {"disagreements": 2, "rate": 0.2},
    }
    assert g["label"]["both_against_benchmark"] == []
    # One "no" from one member; with no "no" from the other, kappa has no chance term to beat.
    assert g["targets_ok"]["between_members"]["disagreements"] == 1
    assert g["targets_ok"]["no"] == {"first": 0, "second": 1}


def test_kappa_is_undefined_when_both_members_give_one_label_throughout() -> None:
    assert agreement.cohen_kappa(["yes"] * 4, ["yes"] * 4) is None
    assert agreement.cohen_kappa(["a", "b", "a", "b"], ["b", "a", "b", "a"]) == pytest.approx(-1.0)


def test_an_unfilled_or_unknown_label_is_refused(tmp_path: Path) -> None:
    filled(tmp_path / "gatemem-first.csv", ["refuse"] * 9 + [""], ["yes"] * 10)
    filled(tmp_path / "gatemem-second.csv", ["refuse"] * 10, ["yes"] * 10)
    with pytest.raises(ValueError, match="gatemem/ckpt_09"):
        agreement.compare_dir(tmp_path, ["first", "second"])
    filled(tmp_path / "gatemem-first.csv", ["refuse"] * 9 + ["maybe"], ["yes"] * 10)
    with pytest.raises(ValueError, match="maybe"):
        agreement.compare_dir(tmp_path, ["first", "second"])


def test_two_sheets_must_hold_the_same_items(tmp_path: Path) -> None:
    filled(tmp_path / "gatemem-first.csv", ["refuse"] * 10, ["yes"] * 10)
    filled(tmp_path / "gatemem-second.csv", ["refuse"] * 9, ["yes"] * 9)
    with pytest.raises(ValueError, match="same items"):
        agreement.compare_dir(tmp_path, ["first", "second"])
