"""The limits every experiment runner config carries (lead-decisions items 3 and 4).

The turn limit is 8 model calls a session in every experiment config the
runner reads (item 4). Each such config's spend ceiling is 1.25 times its
run's high cost estimate with reasoning off, on the lead's models, as
research/results/h2-cost-table.json prices it (item 3): the sum of the
`ceiling` of the run's rows in the `decided` reading, the model under test
priced as the lead's M1 and each judge as itself. A ceiling typed into a
config is checked here against the committed table, so it is never a number
that exists only in the config (AGENTS.md rule 9).
"""

from __future__ import annotations

from typing import Any

import pytest

from scripts.results_io import REPO, load_config

CONFIGS = REPO / "research" / "configs"
TABLE = load_config(REPO / "research" / "results" / "h2-cost-table.json")

# Each experiment config of the runner, and the rows of the cost table that
# price its run (an id equal to a prefix, or under it).
RUNS = {
    "h1-gatemem.json": ("h1-gatemem/",),
    "h1-mem-inv.json": ("h1-mem-inv/", "h1-mem-inv-notes/"),
    "h2-longmemeval-c2.json": ("h2-longmemeval/C2",),
    "h2-longmemeval-c5-medium.json": ("h2-longmemeval/C5",),
}


def lead_m1() -> str:
    option = TABLE["decided"]["item_1"]
    return str(TABLE["options"]["item_1"][option]["M1"])


def ceiling(prefixes: tuple[str, ...]) -> float:
    m1 = lead_m1()
    total = 0.0
    rows = [r for r in TABLE["rows"] if any(r["id"].startswith(p) for p in prefixes)]
    assert rows, f"no cost-table row for {prefixes}"
    for row in rows:
        priced: dict[str, Any] = row["dollars_decided"]
        model = m1 if row["role"] == "M1" else next(iter(priced))
        assert row["role"] in ("M1", None), f"{row['id']} is priced for {row['role']}"
        total += float(priced[model]["ceiling"])
    return total


def test_every_experiment_config_of_the_runner_is_listed() -> None:
    experiments = sorted(
        path.name
        for path in CONFIGS.glob("*.json")
        if load_config(path).get("kind") == "experiment"
        and load_config(path).get("benchmark") in ("gatemem", "mem-inv-bench", "longmemeval")
    )
    assert experiments == sorted(RUNS)


@pytest.mark.parametrize("name", sorted(RUNS))
def test_the_turn_limit_is_8(name: str) -> None:
    assert load_config(CONFIGS / name)["turn_limit"] == 8


@pytest.mark.parametrize("name", sorted(RUNS))
def test_the_spend_ceiling_is_125_percent_of_the_runs_high_estimate(name: str) -> None:
    config = load_config(CONFIGS / name)
    assert config["model"] == "prereg/M1"
    assert TABLE["ceiling_factor"] == 1.25
    assert config["spend_ceiling_usd"] == pytest.approx(ceiling(RUNS[name]), abs=0.005)


def test_the_ceilings_are_the_ones_the_pre_registration_names() -> None:
    prereg = (REPO / "docs" / "research" / "preregistration.md").read_text(encoding="utf-8")
    for name in RUNS:
        value = load_config(CONFIGS / name)["spend_ceiling_usd"]
        assert f"{value:,.2f}" in prereg, f"{name}: {value} is not in the Models section"
