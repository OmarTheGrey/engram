"""H1's figure from the H1 table: violation rate per condition per arm, and C4 minus C5.

Usage:
    uv run python research/scripts/h1_figure.py --config research/configs/h1-figure.json \\
        --out research/results/h1-figure.svg

The config names the table (`table`, a path from the repository root, the
output of research/scripts/h1_table.py). One row per arm (GateMem's primary
set, then MEM-INV-Bench), each with two panels: on the left the violation
rate of C2 to C5 on the primary model with its Wilson 95 percent interval
(the table's `rates`); on the right the tested contrast, C4 minus C5, its
paired mean difference with the BCa interval and, in the label, its
one-sided p-value and the relative reduction with its percentile interval
(`effect`, table version 3; proposed, not registered). A caption gives H1's
decision, or says the table decides nothing (the gate-by-action reading).

The figure is SVG written by hand, not by a plotting library, so it is
byte-stable by construction: fixed element order, no ids but fixed ones,
coordinates and numbers in fixed formats, no time, no absolute path, a fixed
font stack, and the table's sha256 in its `desc` (AGENTS.md rule 9). A
figure drawn from fixture or planted data never goes into research/results/:
`main` refuses an output there unless the table is research/results/h1-table.json,
both paths resolved (`check_destination`). The table must be `h1-table/3`,
which carries the effect block; the relative reduction is labelled "not
registered" beside the registered numbers.
"""

from __future__ import annotations

import argparse
import json
import math
from collections.abc import Mapping, Sequence
from pathlib import Path
from typing import Any
from xml.sax.saxutils import escape

from scripts.results_io import REPO, load_config, sha256_file

CONDITIONS = ("C2", "C3", "C4", "C5")
ARMS = (("gatemem", "GateMem"), ("mem-inv-bench", "MEM-INV-Bench"))
TESTED = "C4-C5"
TABLE_SCHEMA = "h1-table/3"
RESULTS = "research/results"
COMMITTED_TABLE = "research/results/h1-table.json"

WIDTH = 760
ROW = 250
TOP = 64
BOTTOM = 56
RATE_X = (80.0, 450.0)
DIFF_X = (530.0, 730.0)
PLOT_TOP = 44.0
PLOT_BOTTOM = 196.0

FONT = "DejaVu Sans, Arial, Helvetica, sans-serif"
INK = "#0b0b0b"
INK_2 = "#52514e"
MUTED = "#c3c2b7"
SURFACE = "#fcfcfb"
ENFORCED = "#2a78d6"


def _n(x: float) -> str:
    """A coordinate: two decimals, no negative zero."""
    text = f"{x:.2f}"
    return "0.00" if text == "-0.00" else text


def _v(x: float | None, digits: int = 3) -> str:
    return "n/a" if x is None else f"{x:.{digits}f}"


def _p(x: float) -> str:
    return "< 0.0001" if x < 0.0001 else f"{x:.4f}"


def _text(
    x: float,
    y: float,
    body: str,
    *,
    size: int = 11,
    anchor: str = "start",
    fill: str = INK,
    weight: str = "normal",
) -> str:
    return (
        f'<text x="{_n(x)}" y="{_n(y)}" font-size="{size}" text-anchor="{anchor}" '
        f'fill="{fill}" font-weight="{weight}">{escape(body)}</text>'
    )


def _line(x1: float, y1: float, x2: float, y2: float, stroke: str, width: float = 1.0) -> str:
    return (
        f'<line x1="{_n(x1)}" y1="{_n(y1)}" x2="{_n(x2)}" y2="{_n(y2)}" '
        f'stroke="{stroke}" stroke-width="{width:g}"/>'
    )


def _ticks(low: float, high: float, step: float) -> list[float]:
    first = math.ceil(low / step - 1e-9)
    last = math.floor(high / step + 1e-9)
    return [k * step for k in range(first, last + 1)]


def _rate_top(rates: Sequence[Mapping[str, Any]]) -> float:
    """The rate axis's top: the highest Wilson bound rounded up to a tenth, at least 0.1."""
    high = max([float(r["wilson_high"]) for r in rates] + [0.1])
    return min(1.0, math.ceil(high * 10.0 - 1e-9) / 10.0)


def _diff_range(contrast: Mapping[str, Any]) -> tuple[float, float]:
    """The difference axis: zero and the whole interval, padded to a twentieth."""
    low = min(0.0, float(contrast["low"]))
    high = max(0.0, float(contrast["high"]))
    low = math.floor(low * 20.0 - 1e-9) / 20.0 if low < 0 else 0.0
    high = math.ceil(high * 20.0 - 1e-9) / 20.0 if high > 0 else 0.0
    if high - low < 0.05:
        high = low + 0.05
    return max(-1.0, low), min(1.0, high)


def _arm_rows(table: Mapping[str, Any], benchmark: str) -> list[dict[str, Any]]:
    model = table["primary_model"]
    by = {
        r["condition"]: r
        for r in table["rates"]
        if r["benchmark"] == benchmark and r["model"] == model
    }
    return [by[c] for c in CONDITIONS if c in by]


def _tested(table: Mapping[str, Any], benchmark: str) -> dict[str, Any] | None:
    model = table["primary_model"]
    return next(
        (
            c
            for c in table["contrasts"]
            if c["benchmark"] == benchmark and c["model"] == model and c["contrast"] == TESTED
        ),
        None,
    )


def _arm(table: Mapping[str, Any], benchmark: str, label: str, y0: float) -> list[str]:
    rates = _arm_rows(table, benchmark)
    out: list[str] = [f'<g id="arm-{benchmark}" transform="translate(0 {_n(y0)})">']
    primary_set = table.get("gatemem_primary_set")
    title = label
    if benchmark == "gatemem" and primary_set is not None:
        title = f"{label}, {primary_set['name']} checkpoints"
    out.append(_text(RATE_X[0], 24.0, title, size=13, weight="bold"))

    top = _rate_top(rates)
    span = PLOT_BOTTOM - PLOT_TOP

    def ry(v: float) -> float:
        return PLOT_BOTTOM - v / top * span

    for t in _ticks(0.0, top, 0.1 if top > 0.3 else 0.05):
        out.append(_line(RATE_X[0], ry(t), RATE_X[1], ry(t), MUTED, 0.5))
        out.append(
            _text(RATE_X[0] - 6.0, ry(t) + 4.0, f"{t:.2f}", size=10, anchor="end", fill=INK_2)
        )
    out.append(_line(RATE_X[0], PLOT_BOTTOM, RATE_X[1], PLOT_BOTTOM, INK_2))
    out.append(_text(RATE_X[0] - 52.0, PLOT_TOP - 10.0, "violation rate", size=10, fill=INK_2))
    slot = (RATE_X[1] - RATE_X[0]) / len(CONDITIONS)
    for k, condition in enumerate(CONDITIONS):
        x = RATE_X[0] + slot * (k + 0.5)
        out.append(_text(x, PLOT_BOTTOM + 16.0, condition, size=11, anchor="middle"))
        row = next((r for r in rates if r["condition"] == condition), None)
        if row is None:
            out.append(_text(x, PLOT_BOTTOM - 8.0, "not run", size=10, anchor="middle", fill=INK_2))
            continue
        colour = ENFORCED if condition == "C5" else INK_2
        lo, hi, rate = float(row["wilson_low"]), float(row["wilson_high"]), float(row["rate"])
        out.append(_line(x, ry(lo), x, ry(hi), colour, 2.0))
        out.append(_line(x - 5.0, ry(lo), x + 5.0, ry(lo), colour, 2.0))
        out.append(_line(x - 5.0, ry(hi), x + 5.0, ry(hi), colour, 2.0))
        out.append(
            f'<circle cx="{_n(x)}" cy="{_n(ry(rate))}" r="4.5" fill="{colour}" '
            f'stroke="{SURFACE}" stroke-width="2"/>'
        )
        # A point within 8 px of the axis takes its label above it, clear of the axis line.
        label_y = ry(rate) - 8.0 if PLOT_BOTTOM - ry(rate) < 8.0 else ry(rate) + 4.0
        out.append(_text(x + 9.0, label_y, _v(rate), size=10, fill=INK))
        out.append(
            _text(x, PLOT_BOTTOM + 30.0, f"n = {row['items']}", size=9, anchor="middle", fill=INK_2)
        )

    contrast = _tested(table, benchmark)
    out.append(_text(DIFF_X[0], 24.0, "C4 minus C5", size=13, weight="bold"))
    if contrast is None:
        out.append(_text(DIFF_X[0], PLOT_TOP + 20.0, "no contrast", size=11, fill=INK_2))
        out.append("</g>")
        return out
    low, high = _diff_range(contrast)

    def dx(v: float) -> float:
        return DIFF_X[0] + (v - low) / (high - low) * (DIFF_X[1] - DIFF_X[0])

    mid = (PLOT_TOP + PLOT_BOTTOM) / 2.0 - 20.0
    for t in _ticks(low, high, 0.05 if high - low <= 0.3 else 0.1):
        out.append(_line(dx(t), PLOT_TOP, dx(t), mid + 30.0, MUTED, 0.5))
        out.append(_text(dx(t), mid + 44.0, f"{t:.2f}", size=10, anchor="middle", fill=INK_2))
    out.append(_line(dx(0.0), PLOT_TOP, dx(0.0), mid + 30.0, INK, 1.0))
    mean, c_low, c_high = float(contrast["mean"]), float(contrast["low"]), float(contrast["high"])
    out.append(_line(dx(c_low), mid, dx(c_high), mid, ENFORCED, 2.0))
    out.append(_line(dx(c_low), mid - 5.0, dx(c_low), mid + 5.0, ENFORCED, 2.0))
    out.append(_line(dx(c_high), mid - 5.0, dx(c_high), mid + 5.0, ENFORCED, 2.0))
    out.append(
        f'<circle cx="{_n(dx(mean))}" cy="{_n(mid)}" r="4.5" fill="{ENFORCED}" '
        f'stroke="{SURFACE}" stroke-width="2"/>'
    )
    lines = [
        f"difference {_v(mean)} [{_v(c_low)}, {_v(c_high)}] {contrast['method']}",
        f"one-sided p {_p(float(contrast['p_one_sided']))}, n = {contrast['n']} items",
    ]
    effect = contrast.get("effect")
    if effect is not None:
        lines.append(
            f"relative reduction (not registered) {_v(effect['relative_reduction'], 2)} "
            f"[{_v(effect['low'], 2)}, {_v(effect['high'], 2)}]"
        )
    for k, body in enumerate(lines):
        out.append(_text(DIFF_X[0], mid + 64.0 + 14.0 * k, body, size=10, fill=INK))
    out.append("</g>")
    return out


def _caption(table: Mapping[str, Any]) -> str:
    if not table.get("decides", True) or "decision" not in table:
        return "This table decides nothing (gate-by-action reading); no Holm, no decision."
    decision, holm = table["decision"], table["holm"]
    how = "Holm over five" if holm["method"] == "holm" else "interim bound 5p"
    return (
        f"H1: {decision['h1']} (primary {decision['primary']}, {how}, adjusted p "
        f"{_p(float(holm['adjusted']))}; MEM-INV-Bench {decision['secondary']})."
    )


def render(table: Mapping[str, Any], source: str, digest: str) -> str:
    """The figure's SVG text for an H1 table (see the module docstring)."""
    if table.get("schema") != TABLE_SCHEMA:
        raise ValueError(
            f"the figure draws an {TABLE_SCHEMA} table, not {table.get('schema')!r}: "
            "an older table has no effect block"
        )
    arms = [(b, label) for b, label in ARMS if _arm_rows(table, b)]
    if not arms:
        raise ValueError("the table has no rate on the primary model")
    height = TOP + ROW * len(arms) + BOTTOM
    head = (
        f"Violation rate per condition, Wilson 95 percent (left); C4 minus C5, paired "
        f"bootstrap (right). Model {table['primary_model']}, store {table['store']}."
    )
    provenance = f"From {source}, sha256 {digest}, schema {table['schema']}."
    out = [
        '<svg xmlns="http://www.w3.org/2000/svg" version="1.1" '
        f'width="{WIDTH}" height="{height}" viewBox="0 0 {WIDTH} {height}" '
        f'font-family="{FONT}">',
        "<title>H1: enforcement against instruction</title>",
        f"<desc>{escape(provenance)}</desc>",
        f'<rect x="0" y="0" width="{WIDTH}" height="{height}" fill="{SURFACE}"/>',
        _text(
            24.0, 30.0, "H1: enforcement (C5) against instruction (C3, C4)", size=15, weight="bold"
        ),
        _text(24.0, 48.0, head, size=10, fill=INK_2),
    ]
    for k, (benchmark, label) in enumerate(arms):
        out.extend(_arm(table, benchmark, label, TOP + ROW * k))
    out.append(_text(24.0, height - 22.0, _caption(table), size=11))
    out.append("</svg>")
    return "\n".join(out) + "\n"


def check_destination(out: Path, table: Path) -> None:
    """Refuse a figure under research/results/ unless it is drawn from the committed H1 table.

    Both paths are resolved (`..` and symlinks) before they are compared, so
    a planted or fixture table cannot reach research/results/ by a detour
    (review finding X4-1; AGENTS.md rule 9).
    """
    results = (REPO / RESULTS).resolve()
    if not out.resolve().is_relative_to(results):
        return
    if table.resolve() != (REPO / COMMITTED_TABLE).resolve():
        raise ValueError(
            f"a figure under {RESULTS}/ is drawn only from {COMMITTED_TABLE}, not from {table}"
        )


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--config", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args(argv)
    config = load_config(args.config)
    source = str(config["table"])
    path = REPO / source
    check_destination(args.out, path)
    table = json.loads(path.read_text(encoding="utf-8"))
    args.out.parent.mkdir(parents=True, exist_ok=True)
    with args.out.open("w", encoding="utf-8", newline="\n") as f:
        f.write(render(table, source, sha256_file(path)))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
