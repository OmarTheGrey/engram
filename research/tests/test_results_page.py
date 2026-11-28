"""Tests for research/scripts/results_page.py, the generated results page (card X17)."""

from __future__ import annotations

import hashlib
import json
import re
from html.parser import HTMLParser
from itertools import pairwise
from pathlib import Path
from typing import Any

import pytest

from scripts import results_page, results_register
from scripts.results_page import PageError, build, main

REPO = Path(__file__).resolve().parents[2]
PAGE_CONFIG = REPO / "research" / "configs" / "results-page.json"
REGISTER_CONFIG = REPO / "research" / "configs" / "results-register.json"
PAGE = REPO / "docs" / "research" / "results.html"

PREREG = (
    "## Hypotheses\n\n### H1. A\n\n## Proposed amendments, not yet registered\n\n"
    "#### P1. An arm\n\n## Versions\n"
)
SVG = (
    '<?xml version="1.0" encoding="UTF-8"?>\n'
    '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><desc>planted</desc></svg>\n'
)


def _configs() -> tuple[dict[str, Any], dict[str, Any]]:
    page = json.loads(PAGE_CONFIG.read_text(encoding="utf-8"))
    register = json.loads(REGISTER_CONFIG.read_text(encoding="utf-8"))
    return page, register


def test_committed_page_is_current() -> None:
    page, register = _configs()
    assert PAGE.read_text(encoding="utf-8") == build(REPO, page, register), (
        "docs/research/results.html is stale: run make results-page"
    )


def test_the_page_uses_the_registers_vocabulary() -> None:
    # One vocabulary: the page imports the register's statuses, never a copy.
    assert results_page.STATUSES is results_register.STATUSES
    assert results_page.HYPOTHESIS_RESULTS is results_register.HYPOTHESIS_RESULTS
    page, _ = _configs()
    assert page["register"] == "research/configs/results-register.json"


class _Rows(HTMLParser):
    """The cells of the page's manifest table, one list per row."""

    def __init__(self) -> None:
        super().__init__()
        self.inside = False
        self.rows: list[list[str]] = []
        self.cell: list[str] | None = None

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag == "table" and ("id", "manifest-table") in attrs:
            self.inside = True
        elif self.inside and tag == "tr":
            self.rows.append([])
        elif self.inside and tag == "td":
            self.cell = []

    def handle_endtag(self, tag: str) -> None:
        if tag == "table":
            self.inside = False
        elif tag == "td" and self.cell is not None:
            self.rows[-1].append("".join(self.cell).strip())
            self.cell = None

    def handle_data(self, data: str) -> None:
        if self.cell is not None:
            self.cell.append(data)


def test_page_and_register_agree_on_every_row() -> None:
    """Each MANIFEST row appears once on the page, with the register's status and hypothesis."""
    _, register = _configs()
    rows = results_register.load_manifest_rows(REPO)
    parser = _Rows()
    parser.feed(PAGE.read_text(encoding="utf-8"))
    table = [r for r in parser.rows if r]
    by_file = {r["file"]: r for r in register["results"]}
    assert sorted(cells[0] for cells in table) == sorted(rows) == sorted(by_file)
    for file, status, serves, sha, command, _cost in table:
        assert status.startswith(by_file[file]["status"])
        expected = by_file[file]["hypothesis"]
        assert serves == ("no hypothesis" if expected == "none" else expected)
        assert sha == rows[file].sha256
        assert command == (
            f"uv run python {rows[file].script} --config {rows[file].config} --out {file}"
        )


def test_page_is_self_contained() -> None:
    text = PAGE.read_text(encoding="utf-8")
    assert "<script" not in text
    assert not re.search(r"""(src|href)=["']?(https?:)?//""", text)
    assert "@import" not in text and "url(" not in text
    assert "prefers-color-scheme: dark" in text
    assert "\r\n" not in text
    # No dogfood data (AGENTS.md rule 12): no row, config or file the page names is one.
    assert "dogfood" not in "".join(re.findall(r"<code>(.*?)</code>", text)).lower()


def test_proofs_of_concept_are_kept_apart_from_hypothesis_results() -> None:
    _, register = _configs()
    text = PAGE.read_text(encoding="utf-8")
    proofs = text.index('<section id="proofs"')
    hypotheses = text.index('<section id="hypotheses"')
    end_hypotheses = text.index("</section>", hypotheses)
    for r in register["results"]:
        anchor = f'id="{results_page.anchor(r["file"])}"'
        if r["status"] == "proof of concept":
            assert text.index(anchor) > proofs
            assert not hypotheses < text.index(anchor) < end_hypotheses
    assert "No hypothesis has a result yet." in text


# A planted repository: one register-config entry per case, and a page built from it.


def _repo(tmp_path: Path, files: dict[str, bytes], figure: str = "none") -> Path:
    root = tmp_path / "repo"
    (root / "research" / "results").mkdir(parents=True)
    (root / "docs" / "research").mkdir(parents=True)
    lines = ["| file | config | script | commit | sha256 | figure |", "|---|---|---|---|---|---|"]
    for name, body in files.items():
        (root / name).write_bytes(body)
        digest = hashlib.sha256(body).hexdigest()
        stem = Path(name).stem
        lines.append(
            f"| {name} | research/configs/{stem}.json | research/scripts/{stem}.py | abc "
            f"| {digest} | {figure if stem == 'h1-table' else 'none'} |"
        )
    (root / "research" / "results" / "MANIFEST.md").write_text(
        "\n".join(lines) + "\n", encoding="utf-8", newline="\n"
    )
    (root / "docs" / "research" / "preregistration.md").write_text(PREREG, newline="\n")
    return root


def _page() -> dict[str, Any]:
    return {
        "title": "Planted results",
        "register": "research/configs/results-register.json",
        "intro": ["Intro."],
        "proofs_intro": "Proofs.",
        "other_intro": "Other.",
    }


def _register(*results: dict[str, Any]) -> dict[str, Any]:
    return {
        "title": "Results register",
        "intro": ["Intro.", "Runs."],
        "groups": [
            {"id": "H1", "title": "H1. A", "needs": "The live runs."},
            {"id": "none", "title": "Not tied to one hypothesis"},
        ],
        "results": list(results),
    }


def _entry(file: str, **changes: Any) -> dict[str, Any]:
    entry: dict[str, Any] = {
        "file": file,
        "question": "Q?",
        "status": "support artefact",
        "hypothesis": "H1",
        "prereg": "### H1. A",
        "headline": [{"label": "sessions", "path": ["n"]}],
    }
    entry.update(changes)
    return entry


X = "research/results/h1-x.json"
BODY = b'{"n": 1500, "k": 3, "calls": 900, "dollars": 12.5}\n'


def test_without_a_hypothesis_result_the_page_says_so(tmp_path: Path) -> None:
    text = build(_repo(tmp_path, {X: BODY}), _page(), _register(_entry(X)))
    assert "No result for H1 yet" in text
    assert "The live runs." in text
    assert "1,500" in text
    assert "<svg" in text  # the status overview


def test_a_hypothesis_result_is_shown_with_its_figure_and_cost(tmp_path: Path) -> None:
    table = "research/results/h1-table.json"
    figure = "research/results/h1-figure.svg"
    root = _repo(tmp_path, {X: BODY, table: BODY}, figure=figure)
    (root / figure).write_text(SVG, encoding="utf-8", newline="\n")
    statuses = {**results_register.STATUSES, "hypothesis result": "a registered test"}
    cost = [{"label": "model calls", "path": ["calls"]}, {"label": "dollars", "path": ["dollars"]}]
    register = _register(_entry(X), _entry(table, status="hypothesis result", cost=cost))
    text = build(
        root,
        _page(),
        register,
        statuses=statuses,
        hypothesis_results=frozenset({"hypothesis result"}),
    )
    assert "No result for H1 yet" not in text
    assert "<desc>planted</desc>" in text
    assert "<?xml" not in text
    assert "model calls: 900; dollars: 12.5" in text
    hypotheses = text.index('<section id="hypotheses"')
    assert (
        hypotheses
        < text.index(f'id="{results_page.anchor(table)}"')
        < text.index("</section>", hypotheses)
    )


def test_a_proof_of_concept_gets_its_own_section_and_meter(tmp_path: Path) -> None:
    poc = _entry(
        X,
        status="proof of concept",
        hypothesis="none",
        prereg=None,
        title="Planted proof",
        meter={"part": ["k"], "whole": ["n"], "label": "probes passed"},
    )
    text = build(_repo(tmp_path, {X: BODY}), _page(), _register(poc))
    proofs = text.index('<section id="proofs"')
    assert proofs < text.index("Planted proof")
    assert "3 of 1,500 probes passed" in text
    assert 'width="1.20"' in text  # 3 / 1,500 of the 600-unit bar


def test_headings_do_not_skip_and_bars_are_not_read_twice(tmp_path: Path) -> None:
    poc = _entry(X, status="proof of concept", hypothesis="none", title="T", prereg=None)
    poc["meter"] = {"part": ["k"], "whole": ["n"], "label": "passed"}
    text = build(_repo(tmp_path, {X: BODY}), _page(), _register(poc))
    proofs = text[text.index('<section id="proofs"') :]
    assert "<h3>T</h3>" in proofs and "<h4>" not in proofs.split("</section>")[0]
    levels = [int(m) for m in re.findall(r"<h([1-6])[ >]", text)]
    assert all(b - a <= 1 for a, b in pairwise(levels))
    assert text.count("<svg") == text.count('aria-hidden="true"')
    assert "3 of 1,500 passed" in text  # the bar's text stays, once
    assert "<code>n</code>" in text


def test_key_paths_wrap_at_dots(tmp_path: Path) -> None:
    entry = _entry(X, headline=[{"label": "l", "path": ["a", "b"]}])
    body = b'{"a": {"b": 1}}\n'
    text = build(_repo(tmp_path, {X: body}), _page(), _register(entry))
    assert '<td class="path"><code>a.<wbr>b</code></td>' in text


def test_a_complement_meter_fills_with_whole_minus_part(tmp_path: Path) -> None:
    meter = {"part": ["k"], "whole": ["n"], "label": "held", "complement": "leaked"}
    poc = _entry(X, status="proof of concept", hypothesis="none", title="T", meter=meter)
    text = build(_repo(tmp_path, {X: BODY}), _page(), _register(poc))
    assert "1,497 of 1,500 held; 3 leaked" in text
    assert 'width="598.80"' in text


def test_a_proof_of_concept_serving_a_hypothesis_stays_out_of_its_section(tmp_path: Path) -> None:
    poc = _entry(X, status="proof of concept", title="Planted proof")
    text = build(_repo(tmp_path, {X: BODY}), _page(), _register(poc))
    where = text.index(f'id="{results_page.anchor(X)}"')
    assert where > text.index('<section id="proofs"')
    assert "serves H1" in text
    assert "No result for H1 yet" in text


def test_a_proposed_arm_is_marked_exploratory(tmp_path: Path) -> None:
    arm = _entry(X, hypothesis="none", prereg="#### P1. An arm", status="engineering check")
    text = build(_repo(tmp_path, {X: BODY}), _page(), _register(arm))
    assert "exploratory: a proposed arm, not registered" in text
    plain = build(_repo(tmp_path / "b", {X: BODY}), _page(), _register(_entry(X)))
    assert "exploratory" not in plain


def test_the_page_is_byte_stable(tmp_path: Path) -> None:
    root = _repo(tmp_path, {X: BODY})
    assert build(root, _page(), _register(_entry(X))) == build(root, _page(), _register(_entry(X)))


@pytest.mark.parametrize(
    ("files", "entries", "kwargs", "message"),
    [
        ({X: BODY}, [], {}, "MANIFEST row has no section"),
        ({}, [_entry(X)], {}, "section has no MANIFEST row"),
        ({X: BODY}, [_entry(X, status="hypothesis result")], {}, "is not one of"),
        ({X: BODY}, [_entry(X, hypothesis="H9")], {}, "is not a group"),
        ({X: BODY}, [_entry(X, headline=[{"label": "l", "path": ["m"]}])], {}, "not found"),
        ({X: BODY}, [_entry(X, status="proof of concept")], {}, "needs a title"),
        (
            {X: BODY},
            [_entry(X, status="hypothesis result")],
            {
                "statuses": {"hypothesis result": "r"},
                "hypothesis_results": frozenset({"hypothesis result"}),
            },
            "names no cost",
        ),
        ({"research/results/h1-dogfood.json": BODY}, [], {}, "dogfood"),
        (
            {X: BODY},
            [_entry(X, status="hypothesis result", prereg="#### P1. An arm", cost=[])],
            {
                "statuses": {"hypothesis result": "r"},
                "hypothesis_results": frozenset({"hypothesis result"}),
            },
            "cannot cite '#### P1. An arm', an arm proposed",
        ),
        (
            {X: BODY},
            [
                _entry(
                    X,
                    status="hypothesis result",
                    hypothesis="none",
                    cost=[{"label": "calls", "path": ["calls"]}],
                )
            ],
            {
                "statuses": {"hypothesis result": "r"},
                "hypothesis_results": frozenset({"hypothesis result"}),
            },
            "must serve a hypothesis, not none",
        ),
        (
            {X: BODY},
            [_entry(X, status="proof of concept")],
            {},
            "research/configs/results-register.json, then run make results-page",
        ),
    ],
)
def test_build_refuses(
    tmp_path: Path,
    files: dict[str, bytes],
    entries: list[dict[str, Any]],
    kwargs: dict[str, Any],
    message: str,
) -> None:
    with pytest.raises(PageError, match=message):
        build(_repo(tmp_path, files), _page(), _register(*entries), **kwargs)


def test_build_refuses_a_file_whose_sha256_differs(tmp_path: Path) -> None:
    root = _repo(tmp_path, {X: BODY})
    (root / X).write_bytes(b'{"n": 1}\n')
    with pytest.raises(PageError, match="sha256 does not match"):
        build(root, _page(), _register(_entry(X)))


def test_check_fails_on_a_stale_page(tmp_path: Path) -> None:
    root = _repo(tmp_path, {X: BODY})
    (root / "research" / "configs").mkdir(parents=True)
    (root / "research" / "configs" / "results-register.json").write_text(
        json.dumps(_register(_entry(X))), encoding="utf-8"
    )
    page = tmp_path / "page.json"
    page.write_text(json.dumps(_page()), encoding="utf-8")
    out = root / "docs" / "research" / "results.html"
    args = ["--root", str(root), "--config", str(page), "--out", str(out)]
    assert main([*args, "--check"]) == 1
    assert main(args) == 0
    assert main([*args, "--check"]) == 0
    assert b"\r\n" not in out.read_bytes()
