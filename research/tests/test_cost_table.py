"""The full cost table (card RV8, RV-DES-20): rows, prices, options and the RV1 ceiling.

The table builds on the committed cost results, so its H1 rows must give back
research/results/h1-cost.json's own totals at pi-ai's catalogue prices; a
stale input is refused; shared cells make no new call except as item 2's
option (b) says; and every run not built says it is estimated from the design.
These tests use the committed results and stub only the two inputs that need
the pinned data or node (GateMem's long-context block size, L3's count).
"""

from __future__ import annotations

import json
import shutil
from pathlib import Path
from typing import Any

import pytest

from scripts import cost_table
from scripts.results_io import REPO, load_config

CONFIG = load_config(REPO / "research/configs/cost-table.json")
C1 = {"privacy": 30000.0, "safety": 40000.0, "utility": 30000.0}
COUNTS = {"l3-pilot": {"per_seed": 17, "calls": 51, "fixtures": [{"request_chars": 12178}]}}


def built() -> tuple[dict[str, Any], list[dict[str, Any]], dict[str, Any], dict[str, Any]]:
    inputs = cost_table.load_inputs(CONFIG["inputs"])
    shapes = cost_table.Shapes(CONFIG, inputs, C1, COUNTS)
    rows = cost_table.build_rows(CONFIG, inputs, shapes)
    sets = cost_table.price_sets(CONFIG, inputs)
    flags = cost_table.model_flags(CONFIG, inputs)
    return inputs, rows, sets, flags


def test_h1s_rows_give_back_h1_costs_own_totals() -> None:
    inputs, rows, sets, flags = built()
    h1 = inputs["h1-cost"]
    for arm, prefixes in (
        ("gatemem", ("h1-gatemem/C",)),
        ("mem-inv-bench", ("h1-mem-inv/", "h1-mem-inv-notes/")),
    ):
        mine = [
            r for r in rows if r["id"].startswith(prefixes) and r["caller"] == "model under test"
        ]
        for e in ("low", "high"):
            got = {
                k: sum(cost_table.row_tokens(r)[e][k] for r in mine)
                for k in ("calls", "input", "output")
            }
            want = h1["tokens"][arm][e]
            for k in got:
                assert got[k] == pytest.approx(float(want[k]), rel=1e-6), (arm, e, k)
    terra = "openrouter/openai/gpt-5.6-terra"
    h1_rows = [r for r in rows if r["hypothesis"] == "H1"]
    entry = next(c for c in h1["candidates"] if c["model"] == terra)
    priced = [
        cost_table.dollars(
            r, cost_table.resolve_model(r, {"M1": terra}), sets["pi-ai-1.3.0"], flags
        )
        for r in h1_rows
    ]
    for e in ("low", "high"):
        total = sum(d[e] for d in priced if d is not None)
        assert all(d is not None for d in priced)
        assert total == pytest.approx(float(entry["total_with_judge"][e]), rel=1e-6), e


def test_a_stale_input_is_refused(tmp_path: Path) -> None:
    rel = CONFIG["inputs"]["h1-cost"]
    (tmp_path / rel).parent.mkdir(parents=True)
    shutil.copy(REPO / rel, tmp_path / rel)
    with (tmp_path / rel).open("a", encoding="utf-8") as f:
        f.write(" ")
    with pytest.raises(ValueError, match="sha256"):
        cost_table.load_inputs({"h1-cost": rel}, root=tmp_path)
    with pytest.raises(ValueError, match="MANIFEST"):
        cost_table.load_inputs({"x": "research/results/not-a-result.json"}, root=tmp_path)


def test_every_row_states_how_it_was_counted() -> None:
    _, rows, _, _ = built()
    for r in rows:
        assert r["count"] and r["status"], r["id"]
        if r["benchmark"] in ("merit", "memoryagentbench", "tau2-bench"):
            assert r["status"].startswith("estimated from the design"), r["id"]
    assert {r["hypothesis"] for r in rows} == {"H1", "H2", "H3", "H4", "H5"}


def test_shared_cells_are_free_except_h2s_utility_when_h1_drops_it() -> None:
    _, rows, sets, flags = built()
    t = cost_table.totals(rows, CONFIG, sets, flags)["openrouter-prices"]
    a, b = t["1a/2a/47c"], t["1a/2b/47c"]
    shared = [r for r in rows if r["shared_with"] == "h1-gatemem"]
    assert shared
    terra = CONFIG["options"]["item_1"]["a"]
    prices = sets["openrouter-prices"]

    def high(r: dict[str, Any], *, utility: bool = True) -> float:
        d = cost_table.dollars(
            r, cost_table.resolve_model(r, terra), prices, flags, utility=utility
        )
        assert d is not None
        return d["high"]

    h1 = [r for r in rows if r["id"].startswith("h1-gatemem/")]
    h1_utility = sum(high(r) - high(r, utility=False) for r in h1)
    # H2 shares H1's C2 and C5 cells (and their judge), not C3 and C4.
    h1_shared = sum(high(r) - high(r, utility=False) for r in h1 if r["condition"] in ("C2", "C5"))
    h2_utility = sum(
        high({**r, "groups": [g for g in r["groups"] if g["utility"]]}) for r in shared
    )
    assert h1_shared > 0 and h1_shared == pytest.approx(h2_utility)
    # H1 saves its utility cells; H2 pays again for those it shared.
    h1_drop = a["by_hypothesis"]["H1"]["high"] - b["by_hypothesis"]["H1"]["high"]
    assert h1_drop == pytest.approx(h1_utility)
    h2_rise = b["by_hypothesis"]["H2"]["high"] - a["by_hypothesis"]["H2"]["high"]
    assert h2_rise == pytest.approx(h2_utility)
    assert a["dollars"]["high"] - b["dollars"]["high"] == pytest.approx(h1_utility - h2_utility)


def test_the_ceiling_is_the_factor_times_the_high_estimate_and_47b_halves_the_lint_run() -> None:
    _, rows, sets, flags = built()
    table = cost_table.table(rows, CONFIG, sets, flags, "openrouter-prices")
    for r in table:
        for d in r["dollars"].values():
            if d is not None:
                assert d["ceiling"] == pytest.approx(1.25 * d["high"])
    t = cost_table.totals(rows, CONFIG, sets, flags)["openrouter-prices"]
    lint = next(r for r in table if r["id"].startswith("h3-lint-model/"))
    cost = lint["dollars"][CONFIG["options"]["item_1"]["a"]["M1"]]["high"]
    delta = t["1a/2a/47c"]["dollars"]["high"] - t["1a/2a/47b"]["dollars"]["high"]
    assert delta == pytest.approx(cost / 2)
    assert lint["calls"]["low"] == 95217


def test_the_prices_config_names_its_source_and_date() -> None:
    p = load_config(REPO / CONFIG["prices"][0])
    assert p["source"].startswith("OpenRouter") and p["fetched"] == "2026-11-20"
    for option in CONFIG["options"]["item_1"].values():
        for model in option.values():
            assert model in p["models"], model
    assert json.loads(json.dumps(p)) == p


LEAD = {
    "M1": "openrouter/deepseek/deepseek-v4-pro-0813",
    "M2": "openrouter/z-ai/glm-5.3-flash",
    "M3": "openrouter/mistralai/mistral-large-4-0",
}


def test_the_leads_set_is_an_option_and_its_prices_are_the_second_fetch() -> None:
    assert CONFIG["options"]["item_1"]["d-lead"] == LEAD
    p = load_config(REPO / CONFIG["prices"][0])
    assert p["models"][LEAD["M1"]]["input"] == pytest.approx(1.32)
    assert p["models"][LEAD["M1"]]["output"] == pytest.approx(3.96)
    assert p["models"][LEAD["M2"]]["input"] == pytest.approx(0.0399)
    assert p["models"][LEAD["M2"]]["output"] == pytest.approx(0.0784)
    assert len(p["response_sha256"]) == 64


def test_the_decisions_drop_h4s_store_family_its_memoryagentbench_set_and_c7() -> None:
    _, rows, sets, flags = built()
    spec = CONFIG["decisions"]
    out = cost_table.decided(rows, CONFIG, sets, flags)
    dropped = set(out["rows_dropped"])
    assert dropped
    for r in rows:
        gone = (
            r["run"] == "h4-memoryagentbench"
            or (r["run"] == "h4-gatemem" and r["store"] in ("files", "letta"))
            or r["condition"] == "C7"
        )
        assert (r["id"] in dropped) == gone, r["id"]
    assert (spec["item_1"], spec["item_2"], spec["item_47"]) == ("d-lead", "a", "c")


def test_decided_totals_change_h4_only() -> None:
    _, rows, sets, flags = built()
    reg = cost_table.totals(rows, CONFIG, sets, flags)["openrouter-prices"]["1d-lead/2a/47c"]
    dec = cost_table.decided(rows, CONFIG, sets, flags)["totals"]["openrouter-prices"]["d-lead"]
    for h in ("H1", "H2", "H3", "H5"):
        assert dec["by_hypothesis"][h] == pytest.approx(reg["by_hypothesis"][h]), h
    assert dec["by_hypothesis"]["H4"]["high"] < reg["by_hypothesis"]["H4"]["high"]
    assert dec["calls"]["high"] < reg["calls"]["high"]
    assert dec["unpriced_models"] == []
    assert dec["ceiling"] == pytest.approx(1.25 * dec["dollars"]["high"])
