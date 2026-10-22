"""Completeness of docs/research/preregistration.md (step-0 task S0.12).

Every hypothesis names its conditions, benchmarks, metric, test, stopping rule,
analysis and results files; every condition and benchmark it names is defined;
and every results file in research/results/MANIFEST.md maps to exactly one
hypothesis (docs/conventions/testing.md, "Experiments are tests too").
"""

import re
from fnmatch import fnmatch
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
PREREG = REPO / "docs" / "research" / "preregistration.md"
PINS = REPO / "packages" / "bench" / "PINS.md"
MANIFEST = REPO / "research" / "results" / "MANIFEST.md"

FIELDS = (
    "Statement",
    "Conditions",
    "Benchmarks",
    "Metric",
    "Test",
    "Stopping rule",
    "Analysis",
    "Results",
)


def sections(text: str, level: str) -> dict[str, str]:
    """Map each heading at `level` (e.g. "##") to the text under it."""
    parts = re.split(rf"^{level} (.+)$", text, flags=re.M)
    return {parts[i].strip(): parts[i + 1] for i in range(1, len(parts) - 1, 2)}


def fields(body: str) -> dict[str, str]:
    return {m[1]: m[2].strip() for m in re.finditer(r"^- \*\*(.+?):\*\* (.+)$", body, flags=re.M)}


def table_first_column(body: str) -> list[str]:
    rows = [line for line in body.splitlines() if line.startswith("|")]
    return [row.strip("|").split("|")[0].strip() for row in rows[2:]]


def prereg() -> str:
    return PREREG.read_text(encoding="utf-8")


def hypotheses() -> dict[str, dict[str, str]]:
    top = sections(prereg(), "##")
    hyps = sections(top["Hypotheses"], "###")
    return {name.split(".")[0]: fields(body) for name, body in hyps.items()}


def conditions() -> list[str]:
    return table_first_column(sections(prereg(), "##")["Conditions"])


def benchmarks() -> list[str]:
    return table_first_column(sections(prereg(), "##")["Benchmarks"])


def ids(value: str) -> list[str]:
    return [v.strip() for v in value.split(",") if v.strip()]


def test_there_are_five_hypotheses_h1_to_h5() -> None:
    assert sorted(hypotheses()) == ["H1", "H2", "H3", "H4", "H5"]


def test_every_hypothesis_names_every_field() -> None:
    for name, found in hypotheses().items():
        missing = [f for f in FIELDS if not found.get(f)]
        assert missing == [], f"{name} is missing {missing}"


def test_there_are_seven_conditions_c1_to_c7() -> None:
    assert conditions() == [f"C{i}" for i in range(1, 8)]


def test_hypotheses_name_only_defined_conditions() -> None:
    for name, found in hypotheses().items():
        unknown = set(ids(found["Conditions"])) - set(conditions())
        assert unknown == set(), f"{name} names undefined conditions {unknown}"


def test_the_six_benchmarks_are_the_pinned_ones() -> None:
    pinned = table_first_column(PINS.read_text(encoding="utf-8").split("## Notes")[0])
    assert sorted(benchmarks()) == sorted(pinned)
    assert len(benchmarks()) == 6


def test_hypotheses_name_only_registered_benchmarks() -> None:
    for name, found in hypotheses().items():
        unknown = set(ids(found["Benchmarks"])) - set(benchmarks())
        assert unknown == set(), f"{name} names unregistered benchmarks {unknown}"


def test_three_model_slots_and_three_seeds_are_declared() -> None:
    top = sections(prereg(), "##")
    assert len(table_first_column(top["Models"])) == 3
    seeds = re.findall(r"\b\d+\b", fields(top["Seeds"])["Seeds"])
    assert len(seeds) == 3


def test_every_manifest_result_maps_to_exactly_one_hypothesis() -> None:
    globs = {name: ids(found["Results"]) for name, found in hypotheses().items()}
    files = [
        cells[0].strip()
        for line in MANIFEST.read_text(encoding="utf-8").splitlines()
        if (cells := line.strip().strip("|").split("|"))
        and cells[0].strip().startswith("research/")
    ]
    for file in files:
        owners = [h for h, patterns in globs.items() if any(fnmatch(file, p) for p in patterns)]
        assert len(owners) == 1, f"{file} maps to {owners or 'no hypothesis'}"


def test_results_globs_do_not_overlap() -> None:
    globs = [p for found in hypotheses().values() for p in ids(found["Results"])]
    stems = [g.split("*")[0] for g in globs]
    for i, a in enumerate(stems):
        for b in stems[i + 1 :]:
            assert not (a.startswith(b) or b.startswith(a)), f"{a} and {b} overlap"


def latest_version() -> str:
    rows = table_first_column(sections(prereg(), "##")["Versions"])
    return rows[-1]


def test_models_are_concrete_from_v1() -> None:
    """Placeholders are allowed only in v0.x; the deposited v1 names every model."""
    if latest_version().startswith("v0"):
        return
    models = sections(prereg(), "##")["Models"]
    assert "to be fixed" not in models, f"{latest_version()} still has placeholder models"
