"""The limits every live runner config carries (lead-decisions items 3 and 4).

The turn limit is 8 model calls a session in every experiment config the
runner reads, and in the smoke run's configs, which check H1's live path
(item 4). Each experiment config's spend ceiling is 1.25 times its run's
high cost estimate (item 3), in the dollars the runner meters: the runner's
ledger prices each call at pi-ai 1.3.0's catalogue cost (`model.cost`,
`calculateCost`), not at the OpenRouter list price the cost table uses, so
the ceiling is the table's high token counts (the `decided` reading, the
lead's models) priced at pi-ai's catalogue (the coordinator's decision of
2026-11-21, docs/log/2026-11-21-answers-decision-ceilings-in-ledger-dollars.md).

The catalogue prices the ceilings were computed with are recorded here, and
a test fails if pi-ai's catalogue changes them, since a ceiling computed at
one price bounds another spend at another. Every figure is tied to its run or
its model in the pre-registration, so a number typed there is checked
against the committed table (AGENTS.md rule 9).
"""

from __future__ import annotations

import json
import re
from typing import Any

import pytest

from scripts.results_io import REPO, load_config

CONFIGS = REPO / "research" / "configs"
TABLE = load_config(REPO / "research" / "results" / "h2-cost-table.json")
LIST_PRICES = load_config(CONFIGS / "openrouter-prices.json")["models"]
PREREG = (REPO / "docs" / "research" / "preregistration.md").read_text(encoding="utf-8")
CATALOGUE = (
    REPO / "packages/runner/node_modules/@earendil-works/pi-ai/dist/providers/data/openrouter.json"
)

# pi-ai 1.3.0's catalogue price (input, output; dollars per million tokens)
# for the lead's three models and the two judges, as the ceilings use it.
PI_AI_PRICES = {
    "openrouter/deepseek/deepseek-v4-pro-0813": (0.66, 1.98),
    "openrouter/z-ai/glm-5.3-flash": (0.15, 0.5),
    "openrouter/mistralai/mistral-large-4-0": (0.68, 2.09),
    "openrouter/openai/gpt-4o": (2.5, 10.0),
    "openrouter/openai/gpt-4o-2024-08-06": (2.5, 10.0),
}
# The cost table's list price over pi-ai's, input and output.
RATIOS = {
    "openrouter/deepseek/deepseek-v4-pro-0813": (2.0, 2.0),
    "openrouter/z-ai/glm-5.3-flash": (0.266, 0.1568),
    "openrouter/mistralai/mistral-large-4-0": (1.0294, 1.0048),
    "openrouter/openai/gpt-4o": (1.0, 1.0),
    "openrouter/openai/gpt-4o-2024-08-06": (1.0, 1.0),
}

# Each experiment config of the runner, and the cost-table rows of its run.
RUNS = {
    "h1-gatemem.json": ("h1-gatemem/",),
    "h1-mem-inv.json": ("h1-mem-inv/", "h1-mem-inv-notes/"),
    "h2-longmemeval-c2.json": ("h2-longmemeval/C2",),
    "h2-longmemeval-c5-medium.json": ("h2-longmemeval/C5",),
}
SMOKE = ("smoke-h1-gatemem.json", "smoke-h1-mem-inv.json")


def lead_models() -> dict[str, str]:
    option = TABLE["decided"]["item_1"]
    return {k: str(v) for k, v in TABLE["options"]["item_1"][option].items()}


def run_rows(prefixes: tuple[str, ...]) -> list[tuple[dict[str, Any], str]]:
    """The run's rows, each with the model it is priced as."""
    m1 = lead_models()["M1"]
    rows = [r for r in TABLE["rows"] if any(r["id"].startswith(p) for p in prefixes)]
    assert rows, f"no cost-table row for {prefixes}"
    out = []
    for row in rows:
        assert row["role"] in ("M1", None), f"{row['id']} is priced for {row['role']}"
        out.append((row, m1 if row["role"] == "M1" else next(iter(row["dollars_decided"]))))
    return out


def high(prefixes: tuple[str, ...], prices: dict[str, tuple[float, float]]) -> float:
    total = 0.0
    for row, model in run_rows(prefixes):
        price_in, price_out = prices[model]
        total += (
            row["prompt_tokens"]["high"] * price_in + row["completion_tokens"]["high"] * price_out
        )
    return total / 1e6


def catalogue_entry(model: str) -> dict[str, Any]:
    data = json.loads(CATALOGUE.read_text(encoding="utf-8"))
    found: list[dict[str, Any]] = []

    def walk(node: Any) -> None:
        if isinstance(node, dict):
            if node.get("id") == model.removeprefix("openrouter/") and node.get("api") == (
                "openai-completions"
            ):
                found.append(node)
            for value in node.values():
                walk(value)
        elif isinstance(node, list):
            for value in node:
                walk(value)

    walk(data)
    assert len(found) == 1, f"{model}: {len(found)} catalogue entries"
    return found[0]


def prereg_line(pattern: str) -> re.Match[str]:
    found = list(re.finditer(pattern, PREREG, flags=re.M))
    assert len(found) == 1, f"{len(found)} lines match {pattern}"
    return found[0]


def number(text: str) -> float:
    return float(text.replace(",", ""))


def test_every_experiment_config_of_the_runner_is_listed() -> None:
    experiments = sorted(
        path.name
        for path in CONFIGS.glob("*.json")
        if load_config(path).get("kind") == "experiment"
        and load_config(path).get("benchmark") in ("gatemem", "mem-inv-bench", "longmemeval")
    )
    assert experiments == sorted(RUNS)


@pytest.mark.parametrize("name", sorted(RUNS) + list(SMOKE))
def test_the_turn_limit_is_8(name: str) -> None:
    assert load_config(CONFIGS / name)["turn_limit"] == 8


def test_the_lead_models_and_judges_are_the_recorded_ones() -> None:
    judges = {
        str(load_config(CONFIGS / name)["judge"]["model"])
        for name in RUNS
        if "judge" in load_config(CONFIGS / name)
    }
    assert set(lead_models().values()) | judges == set(PI_AI_PRICES)


@pytest.mark.parametrize("model", sorted(PI_AI_PRICES))
def test_pi_ais_catalogue_price_is_the_one_the_ceilings_use(model: str) -> None:
    cost = catalogue_entry(model)["cost"]
    assert (cost["input"], cost["output"]) == PI_AI_PRICES[model]
    assert not cost.get("tiers"), f"{model}: a tiered price changes what a call costs"


@pytest.mark.parametrize("model", sorted(PI_AI_PRICES))
def test_the_list_to_catalogue_ratio_is_recorded_and_registered(model: str) -> None:
    listed = LIST_PRICES[model]
    ratio = (listed["input"] / PI_AI_PRICES[model][0], listed["output"] / PI_AI_PRICES[model][1])
    assert ratio == pytest.approx(RATIOS[model], abs=5e-5)
    line = prereg_line(
        rf"^- .*`{re.escape(model)}`: list ([\d.]+) and ([\d.]+), pi-ai ([\d.]+) and ([\d.]+), "
        r"ratio ([\d.]+) and ([\d.]+)\.$"
    )
    stated = [float(g) for g in line.groups()]
    assert stated[:2] == [listed["input"], listed["output"]]
    assert stated[2:4] == list(PI_AI_PRICES[model])
    assert stated[4:] == pytest.approx(list(RATIOS[model]), abs=5e-5)


@pytest.mark.parametrize("name", sorted(RUNS))
def test_the_table_tokens_give_back_its_own_list_dollars(name: str) -> None:
    listed = {m: (p["input"], p["output"]) for m, p in LIST_PRICES.items()}
    table = sum(row["dollars_decided"][model]["high"] for row, model in run_rows(RUNS[name]))
    # The table rounds each row's dollars to six decimals.
    assert high(RUNS[name], listed) == pytest.approx(table, abs=1e-6 * len(run_rows(RUNS[name])))


@pytest.mark.parametrize("name", sorted(RUNS))
def test_the_ceiling_is_125_percent_of_the_high_estimate_in_ledger_dollars(name: str) -> None:
    config = load_config(CONFIGS / name)
    assert config["model"] == "prereg/M1"
    assert TABLE["ceiling_factor"] == 1.25
    assert config["spend_ceiling_usd"] == round(1.25 * high(RUNS[name], PI_AI_PRICES), 2)


@pytest.mark.parametrize("name", sorted(RUNS))
def test_the_pre_registration_names_each_runs_ceiling_and_estimates(name: str) -> None:
    config = load_config(CONFIGS / name)
    line = prereg_line(
        rf"^- .*`research/configs/{re.escape(name)}`: ([\d,]+\.\d\d) \(high estimate "
        r"([\d,]+\.\d\d) in ledger dollars, ([\d,]+\.\d\d) at list prices\)\.$"
    )
    ceiling, ledger, listed = (number(g) for g in line.groups())
    prices = {m: (p["input"], p["output"]) for m, p in LIST_PRICES.items()}
    assert ceiling == config["spend_ceiling_usd"]
    assert ledger == round(high(RUNS[name], PI_AI_PRICES), 2)
    assert listed == round(high(RUNS[name], prices), 2)


def test_the_catalogue_is_the_one_pi_ai_ships() -> None:
    package = json.loads(CATALOGUE.parents[3].joinpath("package.json").read_text("utf-8"))
    assert package["version"] == "1.3.0"
