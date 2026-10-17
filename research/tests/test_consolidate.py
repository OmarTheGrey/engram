"""Tests for research/scripts/consolidate_log.py (step-0 task S0.4)."""

import shutil
from pathlib import Path

import pytest

from scripts.consolidate_log import ConsolidationError, consolidate, paragraph

REPO = Path(__file__).resolve().parents[2]
FIXTURE = REPO / "fixtures" / "log"


def fixture_copy(tmp_path: Path) -> Path:
    root = tmp_path / "repo"
    shutil.copytree(FIXTURE / "repo", root)
    return root


def test_fixture_log_produces_byte_identical_drafts(tmp_path: Path) -> None:
    out = tmp_path / "drafts"
    consolidate(FIXTURE / "repo", out)
    expected = sorted(p.name for p in (FIXTURE / "expected").iterdir())
    assert sorted(p.name for p in out.iterdir()) == expected
    for name in expected:
        assert (out / name).read_bytes() == (FIXTURE / "expected" / name).read_bytes(), name


def test_fixture_log_has_ten_entries() -> None:
    entries = [p for p in (FIXTURE / "repo" / "docs" / "log").iterdir() if p.name[0] != "_"]
    assert len(entries) == 10


def test_output_does_not_depend_on_previous_output(tmp_path: Path) -> None:
    out = tmp_path / "drafts"
    consolidate(FIXTURE / "repo", out)
    (out / "stale.md").write_text("left over\n")
    consolidate(FIXTURE / "repo", out)
    assert not (out / "stale.md").exists()


def test_rejects_a_measurement_whose_results_hash_does_not_match_the_manifest(
    tmp_path: Path,
) -> None:
    root = fixture_copy(tmp_path)
    (root / "research" / "results" / "x1-gatemem-2026-10-20.json").write_text('{"tampered": 1}\n')
    with pytest.raises(ConsolidationError) as err:
        consolidate(root, tmp_path / "drafts")
    assert any("sha256 does not match MANIFEST.md" in p for p in err.value.problems)
    assert not (tmp_path / "drafts").exists()


def test_rejects_a_measurement_without_a_config(tmp_path: Path) -> None:
    root = fixture_copy(tmp_path)
    entry = root / "docs" / "log" / "2026-10-20-x1-gatemem-baseline.md"
    entry.write_text(entry.read_text().replace("  - research/configs/x1-gatemem.yaml\n", ""))
    with pytest.raises(ConsolidationError) as err:
        consolidate(root, tmp_path / "drafts")
    assert any(
        "measurement needs a config under research/configs/" in p for p in err.value.problems
    )


def test_rejects_an_evidence_path_that_does_not_exist(tmp_path: Path) -> None:
    root = fixture_copy(tmp_path)
    entry = root / "docs" / "log" / "2026-10-18-pi-context-event.md"
    entry.write_text(entry.read_text().replace("fixtures/sessions/", "fixtures/missing/"))
    with pytest.raises(ConsolidationError) as err:
        consolidate(root, tmp_path / "drafts")
    assert any("evidence path does not exist" in p for p in err.value.problems)


def test_rejects_an_unknown_field(tmp_path: Path) -> None:
    root = fixture_copy(tmp_path)
    entry = root / "docs" / "log" / "2026-10-17-bootstrap.md"
    entry.write_text(
        entry.read_text().replace("supersedes: none\n", "supersedes: none\nmood: ok\n")
    )
    with pytest.raises(ConsolidationError) as err:
        consolidate(root, tmp_path / "drafts")
    assert err.value.problems == ["docs/log/2026-10-17-bootstrap.md: unknown field mood"]


def test_skips_the_template(tmp_path: Path) -> None:
    root = fixture_copy(tmp_path)
    (root / "docs" / "log" / "_template.md").write_text("not an entry\n")
    consolidate(root, tmp_path / "drafts")


def test_paragraph_joins_the_four_sections_in_order() -> None:
    body = "\n**What.** A.\n\n**Why.** B\nb.\n\n**Result.** C.\n\n**Consequence.** D.\n"
    assert paragraph(body) == "A. B b. C. D."
