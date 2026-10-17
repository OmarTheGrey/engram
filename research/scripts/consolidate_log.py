"""Consolidate docs/log into thesis drafts, per docs/conventions/documentation.md.

Usage: python research/scripts/consolidate_log.py [--root DIR] [--out DIR]

Reads every entry under <root>/docs/log (names starting with "_" are skipped),
validates all of them, and only then writes <out>/<chapter>.md for the seven
chapters plus timeline.md, results-index.md and decisions.md. Superseded
entries are left out of every draft. The output is byte-stable: the same
inputs always give the same bytes.
"""

from __future__ import annotations

import argparse
import hashlib
import re
import sys
from dataclasses import dataclass
from datetime import date
from pathlib import Path

FIELDS = (
    "date",
    "author",
    "type",
    "card",
    "chapter",
    "pillar",
    "hypothesis",
    "evidence",
    "supersedes",
)
TYPES = ("decision", "finding", "failure", "measurement", "change", "milestone")
CHAPTERS = {
    "design": "Design",
    "implementation": "Implementation",
    "evaluation": "Evaluation",
    "results": "Results",
    "discussion": "Discussion",
    "limitations": "Limitations",
    "related-work": "Related work",
}
PILLARS = {
    "govern": "Govern",
    "twin": "Twin",
    "distill": "Distill",
    "plane": "Plane",
    "research": "Research",
}
NEEDS_EVIDENCE = ("finding", "failure", "measurement")
SECTIONS = ("What", "Why", "Result", "Consequence")
MAX_WORDS = 150
LOG_DIR = "docs/log"
DECISIONS_DIR = "docs/decisions"
MANIFEST = "research/results/MANIFEST.md"
HEADER = (
    "Consolidated from docs/log by research/scripts/consolidate_log.py. "
    "Edit the entries, not this file."
)

Fields = dict[str, str | list[str]]


class ConsolidationError(Exception):
    def __init__(self, problems: list[str]) -> None:
        super().__init__("\n".join(problems))
        self.problems = problems


@dataclass(frozen=True)
class Entry:
    path: str
    fields: Fields
    body: str

    def get(self, key: str) -> str:
        value = self.fields.get(key, "")
        return value if isinstance(value, str) else ""

    @property
    def evidence(self) -> list[str]:
        value = self.fields.get("evidence", [])
        return value if isinstance(value, list) else []

    def sort_key(self) -> tuple[str, str]:
        return (self.get("date"), self.path)


@dataclass(frozen=True)
class ManifestRow:
    config: str
    sha256: str
    figure: str


@dataclass(frozen=True)
class Adr:
    number: str
    title: str
    status: str


# Frontmatter: scalar "key: value" lines and "key:" followed by "  - item" lists.


def _strip_comment(value: str) -> str:
    quoted = False
    for i, c in enumerate(value):
        if c == '"':
            quoted = not quoted
        if c == "#" and not quoted and (i == 0 or value[i - 1].isspace()):
            return value[:i]
    return value


def _unquote(value: str) -> str:
    v = _strip_comment(value).strip()
    return v[1:-1] if len(v) >= 2 and v[0] == v[-1] == '"' else v


def parse_frontmatter(text: str) -> tuple[Fields, str]:
    lines = text.split("\n")
    if lines[0] != "---":
        raise ValueError("frontmatter must start with an opening --- line")
    if "---" not in lines[1:]:
        raise ValueError("frontmatter has no closing --- line")
    close = lines.index("---", 1)
    fields: Fields = {}
    list_key: str | None = None
    for n, line in enumerate(lines[1:close], start=2):
        if _strip_comment(line).strip() == "":
            continue
        item = re.match(r"^\s+-\s+(.*)$", line)
        if item and list_key is not None:
            target = fields[list_key]
            assert isinstance(target, list)
            target.append(_unquote(item.group(1)))
            continue
        pair = re.match(r"^([a-z_]+):(.*)$", line)
        if not pair:
            raise ValueError(f'line {n}: expected "key: value" or "  - item"')
        key, value = pair.group(1), _unquote(pair.group(2))
        if key in fields:
            raise ValueError(f"line {n}: duplicate key {key}")
        if value == "":
            fields[key] = []
            list_key = key
        else:
            fields[key] = value
            list_key = None
    return fields, "\n".join(lines[close + 1 :])


def sections(body: str) -> dict[str, str]:
    """Map each bold section label to its text, whitespace collapsed."""
    labels = "|".join(SECTIONS)
    pattern = rf"\*\*({labels})\.\*\*(.*?)(?=\*\*(?:{labels})\.\*\*|\Z)"
    return {m.group(1): " ".join(m.group(2).split()) for m in re.finditer(pattern, body, re.S)}


def paragraph(body: str) -> str:
    found = sections(body)
    return " ".join(found[s] for s in SECTIONS if s in found)


# Loading and validation.


def load_entries(root: Path) -> tuple[list[Entry], list[str]]:
    entries: list[Entry] = []
    problems: list[str] = []
    for file in sorted((root / LOG_DIR).glob("*.md")):
        if file.name.startswith("_"):
            continue
        path = f"{LOG_DIR}/{file.name}"
        try:
            fields, body = parse_frontmatter(file.read_text(encoding="utf-8"))
        except ValueError as e:
            problems.append(f"{path}: {e}")
            continue
        entries.append(Entry(path, fields, body))
    return entries, problems


def load_manifest(root: Path) -> dict[str, ManifestRow]:
    file = root / MANIFEST
    if not file.exists():
        return {}
    rows: dict[str, ManifestRow] = {}
    for line in file.read_text(encoding="utf-8").splitlines():
        cells = [c.strip() for c in line.strip().strip("|").split("|")]
        if len(cells) == 6 and cells[0].startswith("research/results/"):
            rows[cells[0]] = ManifestRow(config=cells[1], sha256=cells[4], figure=cells[5])
    return rows


def _is_path(item: str) -> bool:
    return not re.search(r"\s", item) and not re.match(r"https?://", item)


def _is_real_date(value: str) -> bool:
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", value):
        return False
    try:
        date.fromisoformat(value)
    except ValueError:
        return False
    return True


def _check_values(e: Entry, root: Path) -> list[str]:
    p = e.path
    problems: list[str] = []
    for key, allowed in (("type", TYPES), ("chapter", tuple(CHAPTERS)), ("pillar", tuple(PILLARS))):
        if e.get(key) not in allowed:
            problems.append(f"{p}: {key} must be one of {', '.join(allowed)}")
    if not re.fullmatch(r"H[1-5]|none", e.get("hypothesis")):
        problems.append(f"{p}: hypothesis must be H1 to H5 or none")
    if not _is_real_date(e.get("date")):
        problems.append(f"{p}: date must be a real YYYY-MM-DD date")
    elif not p.split("/")[-1].startswith(f"{e.get('date')}-"):
        problems.append(f"{p}: file name must start with the entry date {e.get('date')}")
    if not isinstance(e.fields.get("evidence"), list):
        problems.append(f"{p}: evidence must be a list")
    elif e.get("type") in NEEDS_EVIDENCE and not e.evidence:
        problems.append(f"{p}: type {e.get('type')} needs at least one evidence item")
    for item in filter(_is_path, e.evidence):
        if not (root / item).exists():
            problems.append(f"{p}: evidence path does not exist: {item}")
    sup = e.get("supersedes")
    if sup != "none" and not (sup.startswith(f"{LOG_DIR}/") and (root / sup).exists()):
        problems.append(f"{p}: supersedes must be none or an existing docs/log entry")
    found = list(sections(e.body))
    if found != list(SECTIONS):
        problems.append(f"{p}: body must have {', '.join(SECTIONS)} in that order")
    words = len(e.body.split())
    if words > MAX_WORDS:
        problems.append(f"{p}: body has {words} words, at most {MAX_WORDS} allowed")
    return problems


def _check_measurement(e: Entry, root: Path, manifest: dict[str, ManifestRow]) -> list[str]:
    p = e.path
    results = [i for i in e.evidence if i.startswith("research/results/") and i != MANIFEST]
    configs = [i for i in e.evidence if i.startswith("research/configs/")]
    problems: list[str] = []
    if not results:
        problems.append(f"{p}: measurement needs a results file under research/results/")
    if not configs:
        problems.append(f"{p}: measurement needs a config under research/configs/")
    for r in results:
        row = manifest.get(r)
        if row is None:
            problems.append(f"{p}: {r} is not listed in MANIFEST.md")
            continue
        file = root / r
        if file.exists() and hashlib.sha256(file.read_bytes()).hexdigest() != row.sha256:
            problems.append(f"{p}: {r}: sha256 does not match MANIFEST.md")
        if configs and row.config not in configs:
            problems.append(f"{p}: {r}: config does not match MANIFEST.md ({row.config})")
    return problems


def validate(e: Entry, root: Path, manifest: dict[str, ManifestRow]) -> list[str]:
    problems = [f"{e.path}: missing field {f}" for f in FIELDS if f not in e.fields]
    problems += [f"{e.path}: unknown field {f}" for f in e.fields if f not in FIELDS]
    if problems:
        return problems
    problems += _check_values(e, root)
    if e.get("type") == "measurement":
        problems += _check_measurement(e, root, manifest)
    return problems


def load_adrs(root: Path) -> list[Adr]:
    adrs: dict[str, Adr] = {}
    index = root / DECISIONS_DIR / "README.md"
    if index.exists():
        for line in index.read_text(encoding="utf-8").splitlines():
            m = re.match(r"^\|\s*(\d{4})\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|\s*$", line)
            if m:
                adrs[m.group(1)] = Adr(m.group(1), m.group(2), m.group(3))
    for file in sorted((root / DECISIONS_DIR).glob("[0-9][0-9][0-9][0-9]-*.md")):
        number = file.name[:4]
        text = file.read_text(encoding="utf-8")
        title = re.search(rf"^# ADR {number}: (.+)$", text, re.M)
        status = re.search(r"^Status: (.+)$", text, re.M)
        known = adrs.get(number)
        adrs[number] = Adr(
            number,
            title.group(1).strip() if title else (known.title if known else file.stem),
            status.group(1).strip() if status else (known.status if known else "unknown"),
        )
    return [adrs[n] for n in sorted(adrs)]


# Rendering.


def _cell(text: str) -> str:
    return text.replace("|", "\\|")


def _evidence_note(item: str) -> str:
    return f"<{item}>" if re.match(r"https?://", item) else f"`{item}`"


def _lead(e: Entry) -> str:
    parts = [e.get("date")]
    if e.get("card") != "none":
        parts.append(e.get("card"))
    parts.append(e.get("type"))
    if e.get("hypothesis") != "none":
        parts.append(e.get("hypothesis"))
    if e.get("supersedes") != "none":
        parts.append(f"supersedes {Path(e.get('supersedes')).stem}")
    return ", ".join(parts) + "."


def _finish(lines: list[str]) -> str:
    return "\n".join(lines).rstrip("\n") + "\n"


def render_chapter(key: str, entries: list[Entry]) -> str:
    lines = [f"# {CHAPTERS[key]}", "", HEADER, ""]
    if key == "limitations":
        failures = sorted((e for e in entries if e.get("type") == "failure"), key=Entry.sort_key)
        lines += ["## Failures", ""]
        for e in failures:
            s = sections(e.body)
            lines.append(f"- **{_lead(e)}** {s['What']} Consequence: {s['Consequence']}")
        lines += [""] if failures else ["No failures logged yet.", ""]
    chosen = [e for e in entries if e.get("chapter") == key]
    if not chosen:
        lines += ["No entries yet.", ""]
    notes: list[str] = []
    for pillar, title in PILLARS.items():
        group = sorted((e for e in chosen if e.get("pillar") == pillar), key=Entry.sort_key)
        if not group:
            continue
        lines += [f"## {title}", ""]
        for e in group:
            marks = ""
            for item in e.evidence:
                notes.append(item)
                marks += f"[^{len(notes)}]"
            lines += [f"**{_lead(e)}** {paragraph(e.body)}{marks}", ""]
    lines += [f"[^{i}]: {_evidence_note(item)}" for i, item in enumerate(notes, start=1)]
    return _finish(lines)


def render_timeline(entries: list[Entry]) -> str:
    lines = ["# Timeline", "", HEADER, "", "| date | type | card | what | entry |"]
    lines.append("|---|---|---|---|---|")
    for e in sorted(entries, key=Entry.sort_key):
        if e.get("type") in ("milestone", "decision"):
            what = _cell(sections(e.body).get("What", ""))
            lines.append(
                f"| {e.get('date')} | {e.get('type')} | {e.get('card')} | {what} | {e.path} |"
            )
    return _finish(lines)


def render_results_index(entries: list[Entry], manifest: dict[str, ManifestRow]) -> str:
    lines = ["# Results index", "", HEADER, ""]
    lines.append("| date | card | hypothesis | results file | config | figure | entry |")
    lines.append("|---|---|---|---|---|---|---|")
    for e in sorted(entries, key=Entry.sort_key):
        if e.get("type") != "measurement":
            continue
        for r in (i for i in e.evidence if i.startswith("research/results/") and i != MANIFEST):
            row = manifest[r]
            lines.append(
                f"| {e.get('date')} | {e.get('card')} | {e.get('hypothesis')} | {r} "
                f"| {row.config} | {row.figure} | {e.path} |"
            )
    return _finish(lines)


def render_decisions(adrs: list[Adr], entries: list[Entry]) -> str:
    lines = ["# Decisions", "", HEADER, "", "| ADR | title | status | decision entries |"]
    lines.append("|---|---|---|---|")
    for adr in adrs:
        linked = [
            e.path
            for e in sorted(entries, key=Entry.sort_key)
            if e.get("type") == "decision"
            and any(i.startswith(f"{DECISIONS_DIR}/{adr.number}-") for i in e.evidence)
        ]
        refs = ", ".join(linked) or "none"
        lines.append(f"| {adr.number} | {_cell(adr.title)} | {_cell(adr.status)} | {refs} |")
    return _finish(lines)


def consolidate(root: Path, out: Path) -> list[Path]:
    """Validate every entry under root, then write the drafts to out."""
    entries, problems = load_entries(root)
    manifest = load_manifest(root)
    for e in entries:
        problems += validate(e, root, manifest)
    if problems:
        raise ConsolidationError(problems)

    superseded = {e.get("supersedes") for e in entries}
    current = [e for e in entries if e.path not in superseded]
    drafts = {f"{key}.md": render_chapter(key, current) for key in CHAPTERS}
    drafts["timeline.md"] = render_timeline(current)
    drafts["results-index.md"] = render_results_index(current, manifest)
    drafts["decisions.md"] = render_decisions(load_adrs(root), current)

    out.mkdir(parents=True, exist_ok=True)
    for stale in out.glob("*.md"):
        stale.unlink()
    written = []
    for name in sorted(drafts):
        (out / name).write_text(drafts[name], encoding="utf-8", newline="\n")
        written.append(out / name)
    return written


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0] if __doc__ else None)
    parser.add_argument("--root", type=Path, default=Path("."), help="repository root")
    parser.add_argument(
        "--out", type=Path, help="drafts directory (default: <root>/research/thesis/drafts)"
    )
    args = parser.parse_args(argv)
    out = args.out or args.root / "research" / "thesis" / "drafts"
    try:
        written = consolidate(args.root, out)
    except ConsolidationError as e:
        for problem in e.problems:
            print(problem, file=sys.stderr)
        return 1
    print(f"wrote {len(written)} drafts to {out.as_posix()}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
