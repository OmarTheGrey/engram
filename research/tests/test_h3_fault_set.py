"""H3's seeded-fault set script (card L2) without its heavy input.

`make test-repro` rebuilds the full set from the pinned S split; these tests
check what needs neither the split nor node: the pin the config names, the
fetch guard, the split into worker ranges, and the counts on the committed
fixture-size set (fixtures/bench/longmemeval-faults/).
"""

from __future__ import annotations

import hashlib
from pathlib import Path

import pytest

from scripts import h3_fault_set
from scripts.results_io import REPO, load_config

CONFIG = REPO / "research" / "configs" / "h3-fault-set.json"
FIXTURE = REPO / "fixtures" / "bench" / "longmemeval-faults"
PINNED = REPO / "packages" / "bench" / "src" / "longmemeval" / "pinned.ts"
SUBTYPES = 9


def test_the_config_names_the_cleaned_s_split_at_the_pinned_revision() -> None:
    config = load_config(CONFIG)
    data = config["data"]
    assert data["file"] == "longmemeval_s_cleaned.json"
    pinned = PINNED.read_text(encoding="utf-8")
    assert f'dataset_revision: "{data["revision"]}"' in pinned
    assert f'dataset: "{data["dataset"]}"' in pinned
    assert data["path"].startswith(".engram/upstream/")
    assert str(config["set"]).startswith(".engram/")
    assert h3_fault_set.data_url(data) == (
        "https://huggingface.co/datasets/xiaowu0162/longmemeval-cleaned/resolve/"
        "98d7416c24c778c2fee6e6f3006e7a073259d48f/longmemeval_s_cleaned.json"
    )


def test_a_missing_file_is_not_fetched_offline_or_without_fetch(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    data = {"path": str(tmp_path / "s.json"), "sha256": "0" * 64}
    with pytest.raises(FileNotFoundError):
        h3_fault_set.ensure_pinned_file(data, fetch=False)
    monkeypatch.setenv("ENGRAM_OFFLINE", "1")
    with pytest.raises(RuntimeError, match="ENGRAM_OFFLINE"):
        h3_fault_set.ensure_pinned_file(data, fetch=True)


def test_a_file_whose_hash_differs_from_the_pin_is_refused(tmp_path: Path) -> None:
    path = tmp_path / "s.json"
    path.write_text("[]", encoding="utf-8")
    good = hashlib.sha256(b"[]").hexdigest()
    assert h3_fault_set.ensure_pinned_file({"path": str(path), "sha256": good}, fetch=False) == path
    with pytest.raises(ValueError, match="differs from the pin"):
        h3_fault_set.ensure_pinned_file({"path": str(path), "sha256": "0" * 64}, fetch=False)


@pytest.mark.parametrize(("count", "parts"), [(500, 12), (500, 1), (3, 8), (20, 20), (7, 3)])
def test_the_worker_ranges_cover_every_question_once_in_order(count: int, parts: int) -> None:
    ranges = h3_fault_set.split(count, parts)
    assert len(ranges) == min(count, parts)
    assert [i for lo, hi in ranges for i in range(lo, hi)] == list(range(count))
    assert all(hi > lo for lo, hi in ranges)


def test_the_fixture_set_counts_one_fault_and_one_near_miss_per_subtype_and_question() -> None:
    labels = h3_fault_set.read_jsonl(FIXTURE / "labels.jsonl")
    stats = h3_fault_set.read_jsonl(FIXTURE / "stats.jsonl")
    summary = h3_fault_set.summarise(labels, stats)
    questions = summary["questions"]
    assert questions == 20
    assert summary["labels"] == {
        "total": questions * SUBTYPES * 2,
        "fault": questions * SUBTYPES,
        "near-miss": questions * SUBTYPES,
    }
    assert set(summary["by_subtype"]) == {str(la["subtype"]) for la in labels}
    assert all(
        s["fault"] == questions and s["near-miss"] == questions
        for s in summary["by_subtype"].values()
    )


def test_the_class_counts_split_keyed_from_unkeyed_with_every_cell_present() -> None:
    labels = h3_fault_set.read_jsonl(FIXTURE / "labels.jsonl")
    by_class = h3_fault_set.by_class(labels)
    assert list(by_class) == list(h3_fault_set.CLASSES)
    n = 20
    assert by_class["stale"] == {
        "keyed": {"fault": 2 * n, "near-miss": 2 * n},
        "unkeyed": {"fault": n, "near-miss": n},
    }
    # No field the plane records keys a contradiction: the cell is there, and zero.
    assert by_class["contradictory"]["keyed"] == {"fault": 0, "near-miss": 0}
    assert by_class["misplaced"]["keyed"]["fault"] == n
    assert by_class["unsupported"]["keyed"]["fault"] == 2 * n
    total = sum(cell[k] for c in by_class.values() for cell in c.values() for k in cell)
    assert total == len(labels)


def test_the_lint_counts_name_the_expiry_lint_on_keyed_faults_only() -> None:
    labels = h3_fault_set.read_jsonl(FIXTURE / "labels.jsonl")
    lints = h3_fault_set.by_lint(labels)
    expiry = lints["deterministic"]["expired-validity"]
    assert expiry["keyed"] == {"fault": 20, "near-miss": 20}
    assert expiry["unkeyed"] == {"fault": 0, "near-miss": 0}
    assert set(lints["model"]) == {"contradiction", "unsupported-claim"}
    assert lints["model"]["contradiction"]["unkeyed"]["fault"] == 40
    # wrong-scope: no lint of either tier is built for it.
    assert lints["none"] == {"fault": 20, "near-miss": 20}


def test_a_subtype_whose_labels_disagree_is_refused() -> None:
    labels = h3_fault_set.read_jsonl(FIXTURE / "labels.jsonl")
    broken = [dict(labels[0], keyed=not labels[0]["keyed"]), *labels[1:]]
    with pytest.raises(ValueError, match="disagree"):
        h3_fault_set.by_subtype(broken)
