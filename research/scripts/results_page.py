"""Write docs/research/results.html, the results page, from the results register's config.

Usage: python research/scripts/results_page.py --config research/configs/results-page.json
       --out docs/research/results.html [--check]

One self-contained HTML file (card X17): inline CSS and SVG, no script, no
external asset, light and dark. It is built on the results register's config
(`research/configs/results-register.json`, named by the page config's
`register`) and imports the register's status vocabulary, so the page and the
register cannot list different rows or give a row a different status. Every
value is read from the committed results file at its key path; the sha256,
script and config come from the MANIFEST; nothing is typed.

The page has four parts. Per hypothesis, its results (rows whose status is in
the register's HYPOTHESIS_RESULTS, with the figure the MANIFEST row names
inlined and the cost its `cost` paths read), or, when it has none, a sentence
saying so and what it still needs; then the rows that serve it without testing
it. The proofs of concept, each in its own section with its `title` and, when
it has one, a `meter` (part of whole) drawn in SVG. The other checks. And every
MANIFEST row with its status, sha256, command and cost. A row whose
pre-registration heading sits under "Proposed amendments, not yet registered"
is marked exploratory.

The page is a view of the results, not a result: it has no MANIFEST row (the
page names every row's sha256, so a row of its own would have to name its own
hash). `make results-page` writes it, `CHECK=1` and `make test-repro` fail when
it is stale, and research/tests/test_results_page.py fails when it differs from
what this script would write. It omits each row's commit cell, which the
orchestrator rewrites after merge, and the log entries, which the register
lists.

It refuses what the register refuses about the rows (a row without a section,
a section without a row, a sha256 that differs, an unknown status or group, a
path that names no scalar), and also a proof of concept without a title, a
hypothesis result without cost paths, and any row whose file or config names
dogfood data (AGENTS.md rule 12).
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from collections.abc import Mapping, Sequence
from html import escape
from pathlib import Path
from typing import Any

from scripts.reproduce import MANIFEST, Row, manifest_rows
from scripts.results_register import (
    HYPOTHESIS_RESULTS,
    PREREG,
    STATUSES,
    path_text,
    resolve,
    value_text,
)

# The register's vocabulary, re-exported so a test can check the page uses it and no copy.
__all__ = ["HYPOTHESIS_RESULTS", "STATUSES", "PageError", "anchor", "build", "main"]

REPO = Path(__file__).resolve().parents[2]
PROPOSED = "## Proposed amendments, not yet registered"
REGISTER_CONFIG = "research/configs/results-register.json"
PROOF = "proof of concept"
EXPLORATORY = "exploratory: a proposed arm, not registered"
NO_MODEL = "no model call: regenerated offline from committed inputs"

CSS = """
:root {
  --bg: #fbfbf9; --surface: #ffffff; --ink: #18181a; --ink-2: #55544f; --line: #e2e1da;
  --accent: #2a5fb0; --proof: #1d7a4f; --proof-bg: #e8f4ed; --warn: #8a5a00; --warn-bg: #fbf1dc;
  --none-bg: #f1f0ea; --track: #e7e6df;
  --s1: #2a5fb0; --s2: #6b8fd1; --s3: #1d7a4f; --s4: #8a5a00; --s5: #7b4bb3;
  --s6: #a33a3a; --s7: #3f8f8f; --s8: #6d6c66;
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #131314; --surface: #1c1c1e; --ink: #ecebe6; --ink-2: #a9a8a1; --line: #34343a;
    --accent: #8db4f0; --proof: #6fd39f; --proof-bg: #17301f; --warn: #f0c060; --warn-bg: #33270f;
    --none-bg: #26262a; --track: #303035;
    --s1: #8db4f0; --s2: #5f86c9; --s3: #6fd39f; --s4: #f0c060; --s5: #b996e6;
    --s6: #e58b8b; --s7: #7cc9c9; --s8: #9d9c95;
  }
}
* { box-sizing: border-box; }
body {
  margin: 0; background: var(--bg); color: var(--ink);
  font: 16px/1.55 system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
}
main { max-width: 64rem; margin: 0 auto; padding: 2rem 1rem 4rem; }
h1 { font-size: 1.9rem; line-height: 1.2; margin: 0 0 .5rem; }
h2 {
  font-size: 1.4rem; margin: 2.5rem 0 .75rem; padding-top: .5rem;
  border-top: 1px solid var(--line);
}
h3 { font-size: 1.15rem; margin: 1.5rem 0 .5rem; }
h4 { font-size: 1rem; margin: 0 0 .4rem; overflow-wrap: anywhere; }
p { margin: .5rem 0; }
code {
  font: .86em/1.4 ui-monospace, "Cascadia Mono", Consolas, Menlo, monospace;
  overflow-wrap: anywhere;
}
a { color: var(--accent); }
nav ul { list-style: none; padding: 0; display: flex; flex-wrap: wrap; gap: .4rem 1rem; }
.lede { color: var(--ink-2); }
.standing { padding: .75rem 1rem; background: var(--none-bg); border-radius: .5rem; }
.card {
  background: var(--surface); border: 1px solid var(--line); border-radius: .6rem;
  padding: 1rem; margin: .75rem 0;
}
.proof { border-left: 4px solid var(--proof); }
.verdict { padding: .6rem .9rem; border-radius: .5rem; background: var(--none-bg); }
.badge {
  display: inline-block; font-size: .78rem; padding: .1rem .5rem; margin: 0 .3rem .3rem 0;
  border-radius: 1rem; background: var(--none-bg); color: var(--ink-2);
}
.badge.proof-b { background: var(--proof-bg); color: var(--proof); }
.badge.warn { background: var(--warn-bg); color: var(--warn); }
.meta { color: var(--ink-2); font-size: .9rem; }
.scroll { overflow-x: auto; }
table { border-collapse: collapse; width: 100%; font-size: .9rem; }
th, td {
  text-align: left; vertical-align: top; padding: .35rem .5rem;
  border-bottom: 1px solid var(--line);
}
th { color: var(--ink-2); font-weight: 600; }
td.num { white-space: nowrap; }
.legend {
  list-style: none; padding: 0; display: flex; flex-wrap: wrap; gap: .3rem 1rem;
  font-size: .88rem;
}
.key {
  display: inline-block; width: .8rem; height: .8rem; border-radius: .2rem;
  margin-right: .35rem; vertical-align: -.1rem;
}
svg { max-width: 100%; height: auto; }
#manifest-table { min-width: 64rem; }
#manifest-table td:nth-child(4) code { word-break: break-all; }
/* An inlined figure paints its own light surface; the panel around it follows the theme. */
.figure { background: var(--surface); border: 1px solid var(--line); border-radius: .5rem;
  padding: .5rem; overflow-x: auto; }
td.path code { overflow-wrap: normal; word-break: normal; }
.bar-track { fill: var(--track); }
.bar-fill { fill: var(--proof); }
details summary { cursor: pointer; color: var(--accent); margin: .5rem 0; }
footer { margin-top: 3rem; color: var(--ink-2); font-size: .85rem; }
""".strip()


class PageError(Exception):
    def __init__(self, problems: list[str]) -> None:
        super().__init__("\n".join(problems))
        self.problems = problems


def anchor(file: str) -> str:
    """A row's fixed element id, from its file name."""
    return "r-" + re.sub(r"[^a-z0-9]+", "-", Path(file).stem.lower()).strip("-")


def _proposed_headings(root: Path) -> tuple[set[str], set[str]]:
    """Every pre-registration heading, and those under the proposed-amendments section."""
    headings: set[str] = set()
    proposed: set[str] = set()
    inside = False
    for line in (root / PREREG).read_text(encoding="utf-8").splitlines():
        if not line.startswith("#"):
            continue
        heading = line.strip()
        headings.add(heading)
        if heading.startswith("## ") or heading.startswith("# "):
            inside = heading == PROPOSED
        elif inside:
            proposed.add(heading)
    return headings, proposed


def _value(value: Any) -> str:
    if isinstance(value, str):
        return f"<code>{escape(value)}</code>"
    return escape(value_text(value))


def _text(text: str) -> str:
    """Escaped prose, with the register's `code` spans as code elements."""
    return re.sub(r"`([^`]+)`", r"<code>\1</code>", escape(text))


def _path(path: Sequence[Any]) -> str:
    """A key path that may wrap after each dot, never inside a key."""
    return escape(path_text(path)).replace(".", ".<wbr>")


def _plain(value: Any) -> str:
    return value if isinstance(value, str) else value_text(value)


def _command(row: Row) -> str:
    return f"uv run python {row.script} --config {row.config} --out {row.file}"


def _figure(root: Path, row: Row, problems: list[str]) -> str:
    if row.figure == "none":
        return ""
    path = root / row.figure
    if path.suffix != ".svg" or not path.exists():
        problems.append(f"{row.file}: figure {row.figure} is not an SVG file in the repository")
        return ""
    svg = path.read_text(encoding="utf-8")
    svg = re.sub(r"^<\?xml[^>]*\?>\s*", "", svg).strip()
    return (
        f'<figure class="figure"><!-- {escape(row.figure)} -->{svg}'
        f'<figcaption class="meta">Figure <code>{escape(row.figure)}</code>, inlined as '
        "committed.</figcaption></figure>"
    )


def _meter(part: Any, whole: Any, label: str, complement: str | None = None) -> str:
    """A bar of part over whole; with `complement`, of whole minus part (a zero-leak count)."""
    if not all(isinstance(v, int | float) and not isinstance(v, bool) for v in (part, whole)):
        raise ValueError("a meter's part and whole are numbers")
    shown = whole - part if complement else part
    share = 0.0 if whole == 0 else max(0.0, min(1.0, shown / whole))
    text = f"{value_text(shown)} of {value_text(whole)} {label}"
    if complement:
        text += f"; {value_text(part)} {complement}"
    width = 600.0
    return (
        f'<svg viewBox="0 0 {width:.2f} 18.00" width="100%" height="18" '
        'preserveAspectRatio="none" aria-hidden="true">'
        '<rect class="bar-track" x="0.00" y="0.00" '
        f'width="{width:.2f}" height="18.00" rx="4.00"/><rect class="bar-fill" x="0.00" '
        f'y="0.00" width="{width * share:.2f}" height="18.00" rx="4.00"/></svg>'
        f'<p class="meta">{escape(text)}</p>'
    )


def _overview(counts: Mapping[str, int], statuses: Mapping[str, str]) -> str:
    total = sum(counts.values())
    width = 600.0
    x = 0.0
    rects: list[str] = []
    legend: list[str] = []
    for i, status in enumerate(statuses):
        n = counts.get(status, 0)
        colour = f"var(--s{i % 8 + 1})"
        legend.append(
            f'<li><span class="key" style="background:{colour}"></span>{escape(status)}: {n}</li>'
        )
        if n == 0 or total == 0:
            continue
        w = width * n / total
        rects.append(
            f'<rect x="{x:.2f}" y="0.00" width="{w:.2f}" height="24.00" style="fill:{colour}">'
            f"<title>{escape(status)}: {n}</title></rect>"
        )
        x += w
    return (
        f'<svg viewBox="0 0 {width:.2f} 24.00" width="100%" height="24" '
        f'preserveAspectRatio="none" role="img" '
        f'aria-hidden="true">{"".join(rects)}</svg>'
        f'<ul class="legend">{"".join(legend)}</ul>'
    )


class _Page:
    def __init__(
        self,
        root: Path,
        register: Mapping[str, Any],
        statuses: Mapping[str, str],
        hypothesis_results: frozenset[str],
    ) -> None:
        self.root = root
        self.register = register
        self.statuses = statuses
        self.hypothesis_results = hypothesis_results
        self.problems: list[str] = []
        self.rows = {
            r.file: r for r in manifest_rows((root / MANIFEST).read_text(encoding="utf-8"))
        }
        self.headings, self.proposed = _proposed_headings(root)
        self.data: dict[str, Any] = {}
        self.cost: dict[str, str] = {}

    def check(self) -> list[dict[str, Any]]:
        """The register's sections that pass every check, in config order."""
        rows, problems = self.rows, self.problems
        results: list[dict[str, Any]] = list(self.register["results"])
        group_ids = [g["id"] for g in self.register["groups"]]
        named = [r["file"] for r in results]
        problems += [
            f"{f}: MANIFEST row has no section in the config" for f in rows if f not in named
        ]
        problems += [f"{f}: section has no MANIFEST row" for f in named if f not in rows]
        problems += [
            f"{f}: more than one section" for f in sorted(set(named)) if named.count(f) > 1
        ]
        for row in rows.values():
            if any("dogfood" in c.lower() for c in (row.file, row.config, row.figure)):
                problems.append(
                    f"{row.file}: the page never shows dogfood data (AGENTS.md rule 12)"
                )
        good: list[dict[str, Any]] = []
        for r in results:
            file = r["file"]
            if file not in rows:
                continue
            if r["status"] not in self.statuses:
                problems.append(
                    f"{file}: status {r['status']!r} is not one of {', '.join(self.statuses)}"
                )
                continue
            if r["hypothesis"] not in group_ids:
                problems.append(f"{file}: hypothesis {r['hypothesis']!r} is not a group")
                continue
            prereg = r.get("prereg")
            if prereg is not None and prereg not in self.headings:
                problems.append(f"{file}: {PREREG} has no heading {prereg!r}")
            if r["status"] == PROOF and not r.get("title"):
                problems.append(
                    f"{file}: a proof of concept needs a title for its section: add `title` to "
                    f"its section in {REGISTER_CONFIG}, then run make results-page"
                )
            raw = (self.root / file).read_bytes()
            if hashlib.sha256(raw).hexdigest() != rows[file].sha256:
                problems.append(f"{file}: sha256 does not match MANIFEST.md")
                continue
            self.data[file] = json.loads(raw.decode("utf-8"))
            ok = all(self._resolve(file, h["path"]) is not _MISSING for h in r["headline"])
            if r["status"] in self.hypothesis_results and prereg in self.proposed:
                problems.append(
                    f"{file}: a hypothesis result cannot cite {prereg!r}, an arm proposed in the "
                    "pre-registration's amendments and not registered"
                )
            if r["status"] in self.hypothesis_results and r["hypothesis"] == "none":
                problems.append(f"{file}: a hypothesis result must serve a hypothesis, not none")
            if r["status"] in self.hypothesis_results and not r.get("cost"):
                problems.append(f"{file}: a hypothesis result names no cost paths (`cost`)")
            parts: list[str] = []
            for c in r.get("cost") or []:
                v = self._resolve(file, c["path"])
                ok = ok and v is not _MISSING
                parts.append(f"{c['label']}: {_plain(v)}")
            self.cost[file] = "; ".join(parts) if parts else NO_MODEL
            if meter := r.get("meter"):
                ok = ok and all(
                    self._resolve(file, meter[k]) is not _MISSING for k in ("part", "whole")
                )
            if ok:
                good.append(r)
        return good

    def _resolve(self, file: str, path: Sequence[Any]) -> Any:
        try:
            return resolve(self.data[file], path)
        except ValueError as e:
            self.problems.append(f"{file}: {path_text(path)}: {e}")
            return _MISSING

    def badges(self, r: Mapping[str, Any]) -> str:
        status = r["status"]
        kind = "proof-b" if status == PROOF else ""
        out = [f'<span class="badge {kind}">{escape(status)}</span>']
        if r.get("prereg") in self.proposed:
            out.append(f'<span class="badge warn">{EXPLORATORY}</span>')
        serves = r["hypothesis"]
        said = "no hypothesis" if serves == "none" else "serves " + escape(serves)
        out.append(f'<span class="badge">{said}</span>')
        return "".join(out)

    def card(self, r: Mapping[str, Any], *, level: int = 3, figure: bool = False) -> str:
        file = r["file"]
        row = self.rows[file]
        data = self.data[file]
        title = r.get("title")
        head = (
            f'<h{level}>{escape(title)}</h{level}><p class="meta"><code>{escape(file)}</code></p>'
            if title
            else f"<h{level}><code>{escape(file)}</code></h{level}>"
        )
        lines = [
            f'<article class="card{" proof" if r["status"] == PROOF else ""}" id="{anchor(file)}">',
            head,
            f"<p>{self.badges(r)}</p>",
            f"<p><strong>Question.</strong> {_text(r['question'])}</p>",
            f'<p class="meta">{escape(r["status"])}: {escape(self.statuses[r["status"]])}.</p>',
        ]
        if r.get("prereg"):
            lines.append(
                '<p class="meta">Pre-registration section '
                f"“{escape(r['prereg'].lstrip('# '))}”.</p>"
            )
        if r.get("note"):
            lines.append(f'<p class="meta">{_text(r["note"])}</p>')
        if meter := r.get("meter"):
            lines.append(
                _meter(
                    resolve(data, meter["part"]),
                    resolve(data, meter["whole"]),
                    meter["label"],
                    meter.get("complement"),
                )
            )
        if figure:
            lines.append(_figure(self.root, row, self.problems))
        lines.append(
            '<div class="scroll"><table><thead><tr><th>value</th><th>reads</th>'
            "<th>key path</th></tr></thead><tbody>"
        )
        for h in r["headline"]:
            lines.append(
                f"<tr><td>{escape(h['label'])}</td>"
                f'<td class="num">{_value(resolve(data, h["path"]))}</td>'
                f'<td class="path"><code>{_path(h["path"])}</code></td></tr>'
            )
        lines.append("</tbody></table></div>")
        lines.append(
            f'<p class="meta">Made by <code>{escape(_command(row))}</code>; sha256 '
            f"<code>{row.sha256}</code>; cost: {escape(self.cost[file])}.</p>"
        )
        lines.append("</article>")
        return "\n".join(lines)


_MISSING = object()


def build(
    root: Path,
    page: Mapping[str, Any],
    register: Mapping[str, Any],
    *,
    statuses: Mapping[str, str] = STATUSES,
    hypothesis_results: frozenset[str] = HYPOTHESIS_RESULTS,
) -> str:
    p = _Page(root, register, statuses, hypothesis_results)
    results = p.check()
    if p.problems:
        raise PageError(p.problems)

    counts = dict.fromkeys(statuses, 0)
    for r in results:
        counts[r["status"]] += 1
    groups = [g for g in register["groups"] if g["id"] != "none"]
    ids = [g["id"] for g in groups]
    span = f"{ids[0]} to {ids[-1]}" if len(ids) > 1 else (ids[0] if ids else "any hypothesis")
    decided = [r for r in results if r["status"] in hypothesis_results]
    proofs = [r for r in results if r["status"] == PROOF]
    present = [s for s in statuses if counts[s] and s not in hypothesis_results]
    kinds = (
        ", ".join(present[:-1])
        + (" or " if len(present) > 1 else "")
        + (present[-1] if present else "")
    )
    if decided:
        standing = (
            "<strong>Hypothesis results:</strong> "
            + ", ".join(
                f'<a href="#{anchor(r["file"])}"><code>{escape(r["file"])}</code></a> '
                f"({escape(r['hypothesis'])})"
                for r in decided
            )
            + f". Every other committed file is a {escape(kinds)}."
        )
    else:
        standing = (
            "<strong>No hypothesis has a result yet.</strong> Every committed file is a "
            f"{escape(kinds)}. None is a test of {escape(span)}, and none may be quoted as one."
        )

    body: list[str] = [
        f"<header><h1>{escape(page['title'])}</h1>",
        *(f'<p class="lede">{_text(t)}</p>' for t in page["intro"]),
        f'<p class="standing">{standing}</p></header>',
        "<nav><ul>",
        '<li><a href="#overview">Overview</a></li>',
        '<li><a href="#hypotheses">Hypotheses</a></li>',
        *(f'<li><a href="#g-{escape(g["id"].lower())}">{escape(g["id"])}</a></li>' for g in groups),
        '<li><a href="#proofs">Proofs of concept</a></li>',
        '<li><a href="#other">Other checks</a></li>',
        '<li><a href="#manifest">Every MANIFEST row</a></li>',
        "</ul></nav>",
        '<section id="overview"><h2>Overview</h2>',
        f"<p>{len(results)} results, one per row of "
        "<code>research/results/MANIFEST.md</code>, by status.</p>",
        _overview(counts, statuses),
        '<div class="scroll"><table><thead><tr><th>status</th><th>results</th><th>what it is</th>'
        "</tr></thead><tbody>",
        *(
            f'<tr><td>{escape(s)}</td><td class="num">{counts[s]}</td>'
            f"<td>{escape(statuses[s])}</td></tr>"
            for s in statuses
        ),
        "</tbody></table></div></section>",
        '<section id="hypotheses"><h2>Hypotheses</h2>',
        "<p>A hypothesis result is a row whose status is a registered test of the hypothesis. "
        "Rows that serve a hypothesis without testing it are listed beneath it, each with its "
        "status; proofs of concept are kept apart, in the next section.</p>",
    ]
    for g in groups:
        gid = g["id"]
        mine = [r for r in decided if r["hypothesis"] == gid]
        inputs = [
            r for r in results if r["hypothesis"] == gid and r not in decided and r not in proofs
        ]
        body.append(f'<div id="g-{escape(gid.lower())}"><h3>{escape(g["title"])}</h3>')
        if mine:
            body += [p.card(r, level=4, figure=True) for r in mine]
        else:
            tests = ", ".join(sorted(hypothesis_results))
            why = (
                f"No MANIFEST row serving {escape(gid)} has a status that tests it "
                f"({escape(tests)})."
                if tests
                else "The register defines no status for a hypothesis result yet, so no "
                f"MANIFEST row serving {escape(gid)} tests it."
            )
            body.append(
                f'<p class="verdict"><strong>No result for {escape(gid)} yet.</strong> {why}</p>'
            )
        if g.get("needs"):
            body.append(f"<p><strong>What it still needs.</strong> {_text(g['needs'])}</p>")
        if inputs:
            body.append(
                f"<details><summary>{len(inputs)} committed file{'s' if len(inputs) != 1 else ''} "
                f"that serve {escape(gid)} without testing it</summary>"
            )
            body += [p.card(r, level=4) for r in inputs]
            body.append("</details>")
        body.append("</div>")
    body.append("</section>")

    body += [
        '<section id="proofs"><h2>Proofs of concept</h2>',
        f"<p>{_text(page['proofs_intro'])}</p>",
    ]
    if proofs:
        body += [p.card(r) for r in proofs]
    else:
        body.append('<p class="verdict">No proof of concept is committed yet.</p>')
    body.append("</section>")

    other = [
        r for r in results if r["hypothesis"] == "none" and r not in proofs and r not in decided
    ]
    body += ['<section id="other"><h2>Other checks</h2>', f"<p>{_text(page['other_intro'])}</p>"]
    body += [p.card(r) for r in other]
    body.append("</section>")

    body += [
        '<section id="manifest"><h2>Every MANIFEST row</h2>',
        "<p>Each row regenerates byte for byte with its command; <code>make test-repro</code> "
        "reruns them all and checks every sha256.</p>",
        '<div class="scroll"><table id="manifest-table"><thead><tr><th>file</th><th>status</th>'
        "<th>serves</th><th>sha256</th><th>command</th><th>cost</th></tr></thead><tbody>",
    ]
    by_file = {r["file"]: r for r in results}
    for file, row in p.rows.items():
        r = by_file[file]
        status = escape(r["status"])
        if r.get("prereg") in p.proposed:
            status += f'<br><span class="badge warn">{EXPLORATORY}</span>'
        serves = "no hypothesis" if r["hypothesis"] == "none" else escape(r["hypothesis"])
        body.append(
            f'<tr><td><a href="#{anchor(file)}"><code>{escape(file)}</code></a></td>'
            f"<td>{status}</td><td>{serves}</td><td><code>{row.sha256}</code></td>"
            f"<td><code>{escape(_command(row))}</code></td><td>{escape(p.cost[file])}</td></tr>"
        )
    body.append("</tbody></table></div></section>")
    body.append(
        "<footer><p>Generated by <code>research/scripts/results_page.py</code> from "
        "<code>research/configs/results-page.json</code>, the register's config "
        f"<code>{escape(page['register'])}</code>, <code>research/results/MANIFEST.md</code> "
        "and the results files; run <code>make results-page</code> after any of them changes. "
        "The register, <code>docs/research/results.md</code>, lists the log entries that "
        "record each row.</p></footer>"
    )
    if p.problems:
        raise PageError(p.problems)

    head = (
        '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'
        '<meta name="viewport" content="width=device-width, initial-scale=1">\n'
        '<meta name="color-scheme" content="light dark">\n'
        f"<title>{escape(page['title'])}</title>\n<style>\n{CSS}\n</style>\n</head>\n<body>\n<main>\n"
    )
    return head + "\n".join(body) + "\n</main>\n</body>\n</html>\n"


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0] if __doc__ else None)
    parser.add_argument("--config", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--root", type=Path, default=REPO)
    parser.add_argument("--check", action="store_true", help="fail if --out is not current")
    args = parser.parse_args(argv)
    page = json.loads(args.config.read_text(encoding="utf-8"))
    register = json.loads((args.root / page["register"]).read_text(encoding="utf-8"))
    try:
        text = build(args.root, page, register)
    except PageError as e:
        for problem in e.problems:
            print(problem, file=sys.stderr)
        return 1
    if args.check:
        current = args.out.read_text(encoding="utf-8") if args.out.exists() else ""
        if current != text:
            print(f"{args.out.as_posix()} is stale: run make results-page", file=sys.stderr)
            return 1
        print(f"{args.out.as_posix()} is current")
        return 0
    args.out.parent.mkdir(parents=True, exist_ok=True)
    with args.out.open("w", encoding="utf-8", newline="\n") as f:
        f.write(text)
    print(f"wrote {args.out.as_posix()}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
