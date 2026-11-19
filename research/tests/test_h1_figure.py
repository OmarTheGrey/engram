"""H1's figure (research/scripts/h1_figure.py) on a planted H1 table (card X4).

The table is built by the real pipeline (analysis.h1.build_h1_table, then
the table script's byte-stable writer) from planted sessions in a temporary
folder; nothing here writes into research/results/.
"""

from __future__ import annotations

import json
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Any

import numpy as np
import pytest

from scripts import h1_figure, h1_table
from scripts.results_io import REPO, sha256_file

SVG = "{http://www.w3.org/2000/svg}"
RATES = {"C2": 0.40, "C3": 0.30, "C4": 0.25, "C5": 0.05}


def planted_sessions(path: Path, arms: dict[str, int], kinds: bool = True) -> None:
    rng = np.random.default_rng(20261120)
    rows: list[dict[str, Any]] = []
    for benchmark, items in arms.items():
        for condition, rate in RATES.items():
            draws = rng.random((items, 3)) < rate
            for i in range(items):
                for s in range(3):
                    row: dict[str, Any] = {
                        "benchmark": benchmark,
                        "model": "provider/m1",
                        "store": "fake",
                        "preset": "none" if condition == "C2" else "medium",
                        "condition": condition,
                        "item": f"{benchmark}/{i:03d}",
                        "seed": s + 1,
                        "violation": bool(draws[i, s]),
                    }
                    if benchmark == "gatemem" and kinds:
                        row["kind"] = "access" if i % 2 == 0 else "forgetting"
                    rows.append(row)
    path.write_text("".join(json.dumps(r) + "\n" for r in rows), encoding="utf-8")


def planted_table(tmp_path: Path, arms: dict[str, int], **extra: Any) -> Path:
    sessions = tmp_path / "sessions.jsonl"
    planted_sessions(sessions, arms)
    config = tmp_path / "table.json"
    config.write_text(
        json.dumps(
            {
                "name": "h1-planted",
                "sessions": str(sessions),
                "primary_model": "provider/m1",
                "store": "fake",
                "seed": 7,
                "gatemem_primary": "access",
                **extra,
            }
        ),
        encoding="utf-8",
    )
    table = tmp_path / "h1-table.json"
    assert h1_table.main(["--config", str(config), "--out", str(table)]) == 0
    return table


def draw(tmp_path: Path, table: Path, name: str) -> Path:
    config = tmp_path / "figure.json"
    config.write_text(json.dumps({"name": "h1-figure", "table": str(table)}), encoding="utf-8")
    out = tmp_path / name
    assert h1_figure.main(["--config", str(config), "--out", str(out)]) == 0
    return out


def texts(svg: Path) -> list[str]:
    root = ET.fromstring(svg.read_text(encoding="utf-8"))
    return [t.text or "" for t in root.iter(f"{SVG}text")]


def test_two_runs_give_identical_bytes(tmp_path: Path) -> None:
    table = planted_table(tmp_path, {"gatemem": 200, "mem-inv-bench": 30})
    first, second = draw(tmp_path, table, "a.svg"), draw(tmp_path, table, "b.svg")
    assert first.read_bytes() == second.read_bytes()
    body = first.read_bytes()
    assert b"\r\n" not in body
    assert body.endswith(b"</svg>\n")


def test_the_figure_shows_each_arms_rates_and_the_tested_contrast(tmp_path: Path) -> None:
    table_path = planted_table(tmp_path, {"gatemem": 200, "mem-inv-bench": 30})
    table = json.loads(table_path.read_text(encoding="utf-8"))
    svg = draw(tmp_path, table_path, "h1.svg")
    root = ET.fromstring(svg.read_text(encoding="utf-8"))
    arms = [g.get("id") for g in root.iter(f"{SVG}g")]
    assert arms == ["arm-gatemem", "arm-mem-inv-bench"]
    words = texts(svg)
    assert "GateMem, access checkpoints" in words
    assert "MEM-INV-Bench" in words
    for rate in table["rates"]:
        assert f"{rate['rate']:.3f}" in words
    for benchmark in ("gatemem", "mem-inv-bench"):
        tested = next(c for c in table["contrasts"] if c["benchmark"] == benchmark and c["tested"])
        effect = tested["effect"]
        assert (
            f"difference {tested['mean']:.3f} [{tested['low']:.3f}, {tested['high']:.3f}] "
            f"{tested['method']}"
        ) in words
        assert (
            f"relative reduction (not registered) {effect['relative_reduction']:.2f} "
            f"[{effect['low']:.2f}, {effect['high']:.2f}]"
        ) in words
    caption = words[-1]
    assert caption.startswith(f"H1: {table['decision']['h1']} ")
    assert "interim bound 5p" in caption
    # Four circles per arm for the rates, one for the contrast.
    assert len(list(root.iter(f"{SVG}circle"))) == 2 * (4 + 1)
    desc = root.find(f"{SVG}desc")
    assert desc is not None and sha256_file(table_path) in (desc.text or "")


def test_the_rates_sit_inside_their_wilson_whiskers(tmp_path: Path) -> None:
    """Each rate's circle lies between its two whisker caps on the drawing's y axis."""
    table = planted_table(tmp_path, {"gatemem": 120})
    root = ET.fromstring(draw(tmp_path, table, "h1.svg").read_text(encoding="utf-8"))
    arm = next(g for g in root.iter(f"{SVG}g") if g.get("id") == "arm-gatemem")
    for circle in list(arm.iter(f"{SVG}circle"))[:4]:
        cx, cy = float(circle.get("cx", "0")), float(circle.get("cy", "0"))
        caps = [
            float(line.get("y1", "0"))
            for line in arm.iter(f"{SVG}line")
            if line.get("y1") == line.get("y2")
            and float(line.get("x1", "0")) == pytest.approx(cx - 5.0)
        ]
        assert len(caps) == 2
        assert min(caps) - 1e-6 <= cy <= max(caps) + 1e-6


def test_a_table_without_the_poisoning_arm_draws_one_row(tmp_path: Path) -> None:
    table = planted_table(tmp_path, {"gatemem": 120})
    root = ET.fromstring(draw(tmp_path, table, "h1.svg").read_text(encoding="utf-8"))
    assert [g.get("id") for g in root.iter(f"{SVG}g")] == ["arm-gatemem"]
    assert "MEM-INV-Bench absent" in texts(draw(tmp_path, table, "h1.svg"))[-1]


def test_the_gate_by_action_table_says_it_decides_nothing() -> None:
    table = {
        "schema": "h1-table/3",
        "primary_model": "m",
        "store": "s",
        "decides": False,
        "rates": [
            {
                "benchmark": "gatemem",
                "model": "m",
                "condition": c,
                "rate": 0.1,
                "wilson_low": 0.05,
                "wilson_high": 0.2,
                "items": 10,
            }
            for c in ("C4", "C5")
        ],
        "contrasts": [],
    }
    svg = h1_figure.render(table, "t.json", "0" * 64)
    root = ET.fromstring(svg)
    words = [t.text or "" for t in root.iter(f"{SVG}text")]
    assert words[-1].startswith("This table decides nothing")
    assert "not run" in words and "no contrast" in words


def test_a_table_with_no_rate_on_the_primary_model_is_refused() -> None:
    with pytest.raises(ValueError):
        h1_figure.render(
            {
                "schema": "h1-table/3",
                "primary_model": "m",
                "store": "s",
                "rates": [],
                "contrasts": [],
            },
            "t.json",
            "0" * 64,
        )


# Review fix pass (PR #57): X4-1, X4-3, X4-6.


def test_a_planted_tables_figure_is_refused_under_research_results(tmp_path: Path) -> None:
    """X4-1: only the committed H1 table may draw into research/results/; nothing is written."""
    table = planted_table(tmp_path, {"gatemem": 60})
    config = tmp_path / "figure.json"
    config.write_text(json.dumps({"name": "h1-figure", "table": str(table)}), encoding="utf-8")
    for out in (
        REPO / "research" / "results" / "x4-review-refused.svg",
        REPO / "research" / "scripts" / ".." / "results" / "x4-review-refused.svg",
    ):
        try:
            with pytest.raises(ValueError, match="research/results"):
                h1_figure.main(["--config", str(config), "--out", str(out)])
            assert not out.resolve().exists()
        finally:
            out.resolve().unlink(missing_ok=True)


def test_the_destination_rule_resolves_dot_dot_on_both_paths() -> None:
    results = REPO / "research" / "results"
    committed = results / "h1-table.json"
    # Under research/results/, only the committed table is accepted.
    h1_figure.check_destination(results / "h1-figure.svg", committed)
    h1_figure.check_destination(
        results / "h1-figure.svg",
        REPO / "research" / "configs" / ".." / "results" / "h1-table.json",
    )
    with pytest.raises(ValueError):
        h1_figure.check_destination(
            results / "h1-figure.svg", results / "h1-table-gate-by-action.json"
        )
    with pytest.raises(ValueError):
        h1_figure.check_destination(
            REPO / "research" / "x" / ".." / "results" / "f.svg", REPO / "t.json"
        )
    # Outside research/results/, any table may be drawn (tests, fixtures, a scratch look).
    h1_figure.check_destination(REPO / ".engram" / "h1.svg", REPO / "t.json")


def test_a_table_of_another_schema_is_refused() -> None:
    """X4-3: an h1-table/2 table has no effect block; refused, not drawn without it."""
    with pytest.raises(ValueError, match="h1-table/3"):
        h1_figure.render(
            {
                "schema": "h1-table/2",
                "primary_model": "m",
                "store": "s",
                "rates": [],
                "contrasts": [],
            },
            "t.json",
            "0" * 64,
        )


def test_a_rate_at_the_axis_is_labelled_above_its_point() -> None:
    """X4-6: a rate of exactly 0 draws its label above the point, clear of the axis line."""
    table = {
        "schema": "h1-table/3",
        "primary_model": "m",
        "store": "s",
        "decides": False,
        "rates": [
            {
                "benchmark": "gatemem",
                "model": "m",
                "condition": c,
                "rate": r,
                "wilson_low": 0.0,
                "wilson_high": max(r, 0.1),
                "items": 10,
            }
            for c, r in (("C4", 0.3), ("C5", 0.0))
        ],
        "contrasts": [],
    }
    root = ET.fromstring(h1_figure.render(table, "t.json", "0" * 64))
    labels = {t.text: float(t.get("y", "0")) for t in root.iter(f"{SVG}text")}
    circles = [float(c.get("cy", "0")) for c in root.iter(f"{SVG}circle")]
    assert labels["0.000"] <= h1_figure.PLOT_BOTTOM - 8.0
    assert labels["0.000"] < max(circles)
    # A rate well above the axis keeps its label beside the point.
    assert labels["0.300"] == pytest.approx(min(circles) + 4.0)
