"""Card X16: the gate mutation audit's guards, on planted reports and a fake runner.

The real audit (research/scripts/gate_mutation_audit.py) runs the invariants'
property tests on a scratch copy once per mutant and takes minutes, so
`make test-repro` runs it; these tests check its parts without vitest: how a
report is read, the guards that stop a run, the counts, and that the frozen
mutant set still applies to the committed code.
"""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

import pytest

from scripts import gate_mutation_audit as g
from scripts.results_io import REPO, load_config

CONFIG = REPO / "research/configs/gate-mutation-audit.json"
RESULT = REPO / "research/results/h1-gate-mutation-audit.json"

INV = g.Invariant("I1", "packages/core/test/property/invariants.test.ts", "invariant 1: no leak")
INVS = {"I1": INV, "I2": g.Invariant("I2", INV.file, "invariant 2: no forbidden write")}


def err(name: str, message: str) -> dict[str, str]:
    return {"name": name, "message": message}


def report(*tests: tuple[str, str, list[list[dict[str, str]]]], **extra: Any) -> dict[str, Any]:
    """A report as the copy's reporter writes it: one module, each error a cause chain."""
    body = [{"name": name, "state": state, "errors": errors} for name, state, errors in tests]
    module = {"errors": extra.get("module_errors", []), "tests": body}
    return {"unhandled": extra.get("unhandled", []), "modules": [module]}


# Reading a report.


def test_a_passing_test_is_passed() -> None:
    assert g.classify(report((INV.name, "passed", [])), INV) == g.Outcome("passed")


def test_a_failed_assertion_is_a_kill_also_as_a_property_s_cause() -> None:
    direct = [[err("AssertionError", "expected [] to have length 1")]]
    assert g.classify(report((INV.name, "failed", direct)), INV).status == "assertion"
    caused = [[err("Error", "Property failed after 3 tests"), err("AssertionError", "x")]]
    assert g.classify(report((INV.name, "failed", caused)), INV).status == "assertion"
    false = [
        [
            err("Error", "Property failed after 2 tests"),
            err("Error", "Property failed by returning false"),
        ]
    ]
    assert g.classify(report((INV.name, "failed", false)), INV).status == "assertion"


def test_a_kill_records_the_first_line_of_its_first_assertion() -> None:
    chain = [
        [err("Error", "Property failed after 3 tests\nseed 1"), err("AssertionError", "a\nb")],
        [err("AssertionError", "second")],
    ]
    assert g.classify(report((INV.name, "failed", chain)), INV) == g.Outcome(
        "assertion", message="a"
    )
    long = [[err("AssertionError", "x" * 500)]]
    out = g.classify(report((INV.name, "failed", long)), INV)
    assert out.message == "x" * g.MESSAGE_CHARS


def test_the_dirty_check_covers_every_path_the_copy_takes(monkeypatch: pytest.MonkeyPatch) -> None:
    status = "\0".join(
        [" M packages/core/src/a.ts", " M vitest.shared.ts", "M  fixtures/x.json", " M docs/a.md"]
    )
    monkeypatch.setattr(g, "_git", lambda args: status + "\0")
    assert g.copied_changes(["docs", "research"]) == [
        "fixtures/x.json",
        "packages/core/src/a.ts",
        "vitest.shared.ts",
    ]


def test_a_crash_is_could_not_tell_not_a_kill() -> None:
    chain = [[err("Error", "Property failed after 1 tests"), err("TypeError", "x is undefined")]]
    out = g.classify(report((INV.name, "failed", chain)), INV)
    assert out == g.Outcome(
        "could-not-tell", "red, but not from an assertion: TypeError: x is undefined"
    )
    assert g.classify(report((INV.name, "failed", [])), INV).status == "could-not-tell"


def test_a_timeout_is_could_not_tell_even_beside_an_assertion() -> None:
    chain = [[err("Error", "Test timed out in 120000ms.")], [err("AssertionError", "x")]]
    assert g.classify(report((INV.name, "failed", chain)), INV).status == "could-not-tell"


def test_a_file_that_does_not_load_or_an_unhandled_error_is_could_not_tell() -> None:
    broken = report(module_errors=[[err("SyntaxError", "Unexpected token")]])
    assert g.classify(broken, INV) == g.Outcome(
        "could-not-tell", "the test file failed outside any test (did not load)"
    )
    unhandled = report((INV.name, "passed", []), unhandled=[[err("Error", "late")]])
    assert g.classify(unhandled, INV).status == "could-not-tell"


def test_a_filter_selecting_no_test_or_two_is_could_not_tell() -> None:
    assert g.classify(report((INV.name, "skipped", [])), INV).status == "could-not-tell"
    two = report((INV.name, "passed", []), ("invariant 1: no leak again", "passed", []))
    assert g.classify(two, INV).status == "could-not-tell"
    other = report(("invariant 2: no forbidden write", "passed", []))
    assert g.classify(other, INV).status == "could-not-tell"


def test_no_report_is_could_not_tell() -> None:
    assert g.classify(None, INV).status == "could-not-tell"


def test_the_name_filter_matches_the_name_literally_at_the_end() -> None:
    name = "invariant 5: budgets (recency, utility) hold; replay [too] $1 a.b"
    pattern = g.js_pattern(name)
    # The JavaScript escapes are Python's too for these characters.
    assert re.search(pattern, f"invariants {name}")
    assert not re.search(pattern, f"invariants {name} and more")
    assert not re.search(pattern, "invariants invariant 5: budgets Xrecency, utilityX hold")


# The mutant files.


def mutant(**over: Any) -> dict[str, Any]:
    base = {
        "id": "I1-x",
        "invariant": "I1",
        "area": "read filter",
        "file": "a.ts",
        "find": "a > 0",
        "replace": "a >= 0",
        "what": "w",
    }
    return {**base, **over}


def write_mutants(folder: Path, *bodies: dict[str, Any]) -> Path:
    folder.mkdir()
    for b in bodies:
        (folder / f"{b['id']}.json").write_text(json.dumps(b), encoding="utf-8")
    return folder


def test_a_mutant_file_needs_its_fields_and_its_own_name(tmp_path: Path) -> None:
    good = write_mutants(tmp_path / "ok", mutant(), mutant(id="I1-y", note="equivalent"))
    assert [m.id for m in g.load_mutants(good)] == ["I1-x", "I1-y"]
    missing = mutant()
    del missing["what"]
    with pytest.raises(g.AuditError, match="exactly the fields"):
        g.load_mutants(write_mutants(tmp_path / "missing", missing))
    with pytest.raises(g.AuditError, match="exactly the fields"):
        g.load_mutants(write_mutants(tmp_path / "extra", mutant(expect="killed")))
    renamed = tmp_path / "renamed"
    renamed.mkdir()
    (renamed / "other.json").write_text(json.dumps(mutant()), encoding="utf-8")
    with pytest.raises(g.AuditError, match="not its file name"):
        g.load_mutants(renamed)
    with pytest.raises(g.AuditError, match="nothing is mutated"):
        g.load_mutants(write_mutants(tmp_path / "same", mutant(replace="a > 0")))


def test_a_find_string_must_occur_exactly_once() -> None:
    m = g.Mutant(**mutant())
    g.check_mutant(m, "if (a > 0) b();", INVS)
    with pytest.raises(g.AuditError, match="0 times"):
        g.check_mutant(m, "if (a < 0) b();", INVS)
    with pytest.raises(g.AuditError, match="2 times"):
        g.check_mutant(m, "a > 0 && a > 0", INVS)
    with pytest.raises(g.AuditError, match="not in the config"):
        g.check_mutant(g.Mutant(**mutant(invariant="I9")), "a > 0", INVS)
    assert g.apply_mutant(m, "if (a > 0) b();") == "if (a >= 0) b();"


# The audit loop, with a fake runner.


class Fake:
    """Reads the copy's file to decide, as a test would: a mutated file turns red or stays green."""

    def __init__(self, copy: Path, red: dict[str, g.Outcome]) -> None:
        self.copy = copy
        self.red = red
        self.calls: list[str] = []

    def __call__(self, inv: g.Invariant) -> g.Outcome:
        text = (self.copy / "a.ts").read_text(encoding="utf-8")
        self.calls.append(inv.id)
        for marker, outcome in self.red.items():
            if marker in text:
                return outcome
        return g.Outcome("passed")


def setup_copy(tmp_path: Path) -> Path:
    copy = tmp_path / "copy"
    copy.mkdir()
    (copy / "a.ts").write_text("if (a > 0) b(); if (c) d();", encoding="utf-8")
    return copy


def test_the_audit_runs_baselines_then_each_mutant_and_restores_the_file(tmp_path: Path) -> None:
    copy = setup_copy(tmp_path)
    killed = g.Mutant(**mutant(id="I1-k"))
    survives = g.Mutant(**mutant(id="I2-s", invariant="I2", find="if (c)", replace="if (!c)"))
    fake = Fake(copy, {"a >= 0": g.Outcome("assertion", message="expected 1 to be 2")})
    messages: dict[str, str] = {}
    verdicts = g.audit([killed, survives], INVS, copy, fake, lambda: "", lambda _: None, messages)
    assert verdicts == {"I1-k": "killed", "I2-s": "survived"}
    assert messages == {"I1-k": "expected 1 to be 2"}
    rows = g.summarise([killed, survives], verdicts, INVS, messages)["mutants"]
    assert rows[0]["killed_by"] == "expected 1 to be 2"
    assert "killed_by" not in rows[1]
    assert fake.calls == ["I1", "I2", "I1", "I2"]
    assert (copy / "a.ts").read_text(encoding="utf-8") == "if (a > 0) b(); if (c) d();"


def test_a_red_baseline_stops_the_audit(tmp_path: Path) -> None:
    copy = setup_copy(tmp_path)
    fake = Fake(copy, {"a > 0": g.Outcome("assertion")})
    with pytest.raises(g.AuditError, match="baseline"):
        g.audit([g.Mutant(**mutant())], INVS, copy, fake, lambda: "", lambda _: None)


def test_could_not_tell_stops_the_audit_and_the_file_is_restored(tmp_path: Path) -> None:
    copy = setup_copy(tmp_path)
    fake = Fake(copy, {"a >= 0": g.Outcome("could-not-tell", "red, but not from an assertion")})
    with pytest.raises(g.AuditError, match="could not tell"):
        g.audit([g.Mutant(**mutant())], INVS, copy, fake, lambda: "", lambda _: None)
    assert (copy / "a.ts").read_text(encoding="utf-8") == "if (a > 0) b(); if (c) d();"


def test_a_runner_that_throws_still_leaves_the_file_restored(tmp_path: Path) -> None:
    copy = setup_copy(tmp_path)

    def boom(inv: g.Invariant) -> g.Outcome:
        if "a >= 0" in (copy / "a.ts").read_text(encoding="utf-8"):
            raise KeyboardInterrupt
        return g.Outcome("passed")

    with pytest.raises(KeyboardInterrupt):
        g.audit([g.Mutant(**mutant())], INVS, copy, boom, lambda: "", lambda _: None)
    assert (copy / "a.ts").read_text(encoding="utf-8") == "if (a > 0) b(); if (c) d();"


def test_a_working_tree_that_changes_during_the_run_stops_it(tmp_path: Path) -> None:
    copy = setup_copy(tmp_path)
    states = iter(["clean", "clean", "M packages/core/src/x.ts"])
    with pytest.raises(g.AuditError, match="status changed"):
        g.audit(
            [g.Mutant(**mutant()), g.Mutant(**mutant(id="I1-z", find="if (c)", replace="if (1)"))],
            INVS,
            copy,
            Fake(copy, {}),
            lambda: next(states),
            lambda _: None,
        )


# The counts and the result.


def test_counts_per_invariant_and_the_toothless_invariants() -> None:
    ms = [
        g.Mutant(**mutant(id="I1-a")),
        g.Mutant(**mutant(id="I1-b", note="equivalent: the oracle allows it")),
        g.Mutant(**mutant(id="I2-a", invariant="I2", area="write gate")),
    ]
    s = g.summarise(ms, {"I1-a": "killed", "I1-b": "survived", "I2-a": "survived"}, INVS)
    assert s["per_invariant"]["I1"]["killed"] == 1
    assert s["per_invariant"]["I1"]["survivors"] == ["I1-b"]
    assert s["per_invariant"]["I1"]["kill_rate"] == 0.5
    assert s["totals"] == {
        "mutants": 3,
        "killed": 1,
        "survived": 2,
        "survivors": ["I1-b", "I2-a"],
        "kill_rate": 1 / 3,
    }
    assert s["mutants"][1]["note"] == "equivalent: the oracle allows it"
    assert g.every_invariant_bites(s) == ["I2"]


# The committed set, config and result.


def test_the_config_serves_no_hypothesis_and_is_a_proof_of_concept() -> None:
    config = load_config(CONFIG)
    assert config["hypothesis"] == "none"
    assert config["status"] == "proof of concept"
    assert g.load_invariants(config)


def test_every_frozen_mutant_still_applies_once_to_the_committed_code() -> None:
    config = load_config(CONFIG)
    invariants = g.load_invariants(config)
    mutants = g.load_mutants(REPO / config["mutants"])
    for m in mutants:
        # Raw bytes, as the audit reads them: no newline translation.
        g.check_mutant(m, (REPO / m.file).read_bytes().decode("utf-8"), invariants)
        assert m.file.startswith(tuple(f"{p}/" for p in config["audited"])), m.id
        assert m.id.startswith(f"{m.invariant}-"), m.id
    assert {m.invariant for m in mutants} == set(invariants), "every invariant has a mutant"
    for inv in invariants.values():
        assert f'"{inv.name}"' in (REPO / inv.file).read_text(encoding="utf-8"), inv.id


def test_the_committed_result_covers_the_frozen_set() -> None:
    config = load_config(CONFIG)
    body = json.loads(RESULT.read_text(encoding="utf-8"))
    assert body["hypothesis"] == "none"
    assert body["status"] == "proof of concept"
    mutants = g.load_mutants(REPO / config["mutants"])
    assert [r["id"] for r in body["mutants"]] == [m.id for m in mutants]
    assert all(r["verdict"] in g.VERDICTS for r in body["mutants"])
    assert g.every_invariant_bites(body) == []
