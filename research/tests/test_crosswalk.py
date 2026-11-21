"""The crosswalk (card R4): title parsing, the missing-test check, the config rules and the table.

The parser is plain text matching over TypeScript test files, so it is checked
on small planted files: nesting read from indentation, constants, `+` joins,
`.each` rows, and calls that are no evidence (`.skip`, `.todo`). The committed
crosswalk is then checked as it stands: every test it names exists, the
committed result and the README's table are what the script regenerates, and
every row bears on an obligation and never claims to meet one.
"""

from __future__ import annotations

import copy
import json
from pathlib import Path
from typing import Any

import pytest

from scripts import crosswalk as cw
from scripts.results_io import REPO, dumps_result, load_config

CONFIG_PATH = REPO / "research/configs/crosswalk.json"
RESULT_PATH = REPO / "research/results/h1-crosswalk.json"
README = REPO / "docs/compliance/README.md"

SPEC = """import { describe, expect, test } from "vitest";

const LONG =
  "a title bound to a constant, " + "joined over two literals";

describe("outer", () => {
  describe("inner", () => {
    test("nested test", () => {
      expect(1).toBe(1);
    });
    it(
      "a title on its own line",
      () => {},
    );
    test(LONG, () => {});
  });
  test("outer only", () => {});
  test.skip("skipped", () => {});
  test.todo("to do");
});

describe("sibling", () => {
  test("in sibling", () => {});
});

test.each(["core", "adapters"])("rejects in packages/%s", (pkg) => {});
describe("rows", () => {
  test.each([
    ["KEY=sk-1 x", "KEY=<redacted> x"],
    ["y", "z"],
  ])("%s keeps %s", (a, b) => {});
  test.each([[1, 2]])("%s numbers", (a) => {});
});
test(`template ${1}`, () => {});
test("a \\"quoted\\" title", () => {});
"""


# Titles.


def test_string_literals_of_every_quote_and_their_escapes() -> None:
    assert cw.string_at('"a\\"b" x', 0) == ('a"b', 6)
    assert cw.string_at("'it\\'s'", 0) == ("it's", 7)
    assert cw.string_at("`plain`", 0) == ("plain", 7)
    assert cw.string_at("`has ${x}`", 0) is None
    assert cw.string_at('"\\u00e9\\u{1F600}"', 0) == ("é\U0001f600", 17)
    assert cw.string_at('"unterminated\n"', 0) is None
    assert cw.string_at("x", 0) is None


def test_constants_and_joins_resolve_to_one_title() -> None:
    consts = cw.constants(SPEC)
    assert consts["LONG"] == "a title bound to a constant, joined over two literals"
    assert cw.title_at('A + " more")', 0, {"A": "one"}) == "one more"
    assert cw.title_at("unknown, () => {}", 0, {}) is None
    assert cw.title_at('"a" + b(), x', 0, {}) is None


def test_calls_name_kind_title_modifiers_and_each_row() -> None:
    found = {(c.kind, c.title): c for c in cw.calls(SPEC)}
    assert ("describe", "inner") in found
    assert ("test", "a title on its own line") in found
    assert found[("test", "skipped")].modifiers == frozenset({"skip"})
    assert ("test", "rejects in packages/core") in found
    assert ("test", "rejects in packages/adapters") in found
    assert ("test", 'a "quoted" title') in found
    assert ("test", "KEY=sk-1 x keeps KEY=<redacted> x") in found
    assert ("test", "y keeps z") in found
    assert not any(c.title.startswith("template") for c in found.values())
    assert not any("numbers" in c.title for c in found.values())
    assert cw.find_test(SPEC, ["rows"], "y keeps z")
    assert not cw.find_test(SPEC, ["outer"], "y keeps z")


def test_a_claim_citing_no_obligation_says_why() -> None:
    config = planted_config()
    config["claims"][0]["obligations"] = []
    with pytest.raises(cw.ConfigError, match="say in unmapped why"):
        cw.validate(config)
    config["claims"][0]["unmapped"] = "continuity of work, which neither act addresses"
    cw.validate(config)
    config["claims"][1]["unmapped"] = "a second reason"
    with pytest.raises(cw.ConfigError, match="only for a claim citing no obligation"):
        cw.validate(config)


@pytest.mark.parametrize(
    ("describe", "it"),
    [
        (["outer", "inner"], "nested test"),
        (["outer", "inner"], "a title on its own line"),
        (["outer", "inner"], "a title bound to a constant, joined over two literals"),
        (["outer"], "outer only"),
        (["outer"], "nested test"),
        (["sibling"], "in sibling"),
        ([], "nested test"),
        (["inner"], "nested test"),
        ([], "rejects in packages/core"),
        ([], 'a "quoted" title'),
    ],
)
def test_find_test_finds_a_test_inside_the_named_describes(describe: list[str], it: str) -> None:
    assert cw.find_test(SPEC, describe, it)


@pytest.mark.parametrize(
    ("describe", "it"),
    [
        (["outer", "inner"], "outer only"),
        (["outer"], "in sibling"),
        (["sibling"], "nested test"),
        (["outer"], "skipped"),
        (["outer"], "to do"),
        ([], "rejects in packages/ui"),
        (["outer", "inner"], "nested"),
        ([], "inner"),
    ],
)
def test_find_test_refuses_a_test_outside_them_skipped_or_misnamed(
    describe: list[str], it: str
) -> None:
    assert not cw.find_test(SPEC, describe, it)


# The crosswalk on a planted tree.


def planted_config() -> dict[str, Any]:
    return {
        "name": "crosswalk",
        "statement": "evidence, not compliance",
        "sources": {
            "gdpr": {"short": "GDPR", "file": "gdpr.xhtml", "sha256": "0", "url": "u"},
        },
        "obligations": [
            {
                "id": "GDPR-5-1-f",
                "instrument": "gdpr",
                "article": "5",
                "paragraph": "1",
                "point": "f",
                "heading": "Principles relating to processing of personal data",
                "quote": "appropriate security of the personal data",
            }
        ],
        "claims": [
            {
                "id": "C1",
                "claim": "a read never returns an item outside the reader's scopes and grants",
                "source": "AGENTS.md",
                "invariant": 1,
                "tests": [
                    {"file": "a.test.ts", "describe": ["outer", "inner"], "it": "nested test"}
                ],
                "obligations": [{"id": "GDPR-5-1-f", "relation": "bears on", "why": "access"}],
            },
            {
                "id": "C2",
                "claim": "nothing in core reads the clock",
                "source": "docs/conventions/testing.md",
                "tests": [],
                "gap": "no test checks it",
                "obligations": [{"id": "GDPR-5-1-f", "relation": "bears on", "why": "times"}],
            },
        ],
    }


@pytest.fixture
def tree(tmp_path: Path) -> Path:
    (tmp_path / "a.test.ts").write_text(SPEC, encoding="utf-8")
    return tmp_path


def test_build_marks_a_claim_with_no_test_not_evidenced(tree: Path) -> None:
    result, missing = cw.build(tree, planted_config())
    assert missing == []
    assert [r["status"] for r in result["claims"]] == ["evidenced", "not evidenced"]
    assert result["summary"]["not_evidenced"] == ["C2"]
    assert result["obligations"][0]["claims"] == ["C1", "C2"]


def test_build_reports_a_missing_test_and_a_missing_file(tree: Path) -> None:
    config = planted_config()
    config["claims"][0]["tests"].append({"file": "a.test.ts", "describe": ["outer"], "it": "gone"})
    config["claims"][0]["tests"].append({"file": "b.test.ts", "describe": [], "it": "x"})
    _, missing = cw.build(tree, config)
    assert missing == ["C1: no test a.test.ts > outer > gone", "C1: no file b.test.ts"]


@pytest.mark.parametrize(
    ("path", "value", "message"),
    [
        (["claims", 0, "obligations", 0, "relation"], "satisfies", "never another"),
        (["claims", 0, "claim"], "the plane satisfies Art. 12", "satisf"),
        (["claims", 0, "obligations", 0, "why"], "Engram is compliant here", "compliant"),
        (["claims", 1, "gap"], "", "says why in gap"),
        (["claims", 0, "obligations", 0, "id"], "AIA-99", "unknown obligation"),
        (["obligations", 0, "paragraph"], "", "a paragraph is required"),
        (["obligations", 0, "quote"], " ", "a quote"),
        (["claims", 0, "obligations"], [], "at least one obligation"),
    ],
)
def test_validate_refuses_a_row_it_cannot_stand_behind(
    path: list[Any], value: Any, message: str
) -> None:
    config = planted_config()
    target: Any = config
    for key in path[:-1]:
        target = target[key]
    target[path[-1]] = value
    with pytest.raises(cw.ConfigError, match=message):
        cw.validate(config)


def test_a_quote_may_hold_any_word_of_the_primary_text() -> None:
    config = planted_config()
    config["obligations"][0]["quote"] = "to demonstrate compliance with"
    cw.validate(config)


def test_main_exits_1_and_writes_nothing_when_a_named_test_is_missing(
    tree: Path, tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    config = planted_config()
    config["claims"][0]["tests"][0]["it"] = "renamed"
    path = tmp_path / "config.json"
    path.write_text(json.dumps(config), encoding="utf-8")
    out = tmp_path / "out.json"
    code = cw.main(["--config", str(path), "--out", str(out), "--root", str(tree)])
    assert code == 1
    assert not out.exists()
    assert "missing C1: no test a.test.ts > outer > inner > renamed" in capsys.readouterr().err


def test_main_writes_byte_stable_output_with_no_absolute_path(tree: Path, tmp_path: Path) -> None:
    path = tmp_path / "config.json"
    path.write_text(json.dumps(planted_config()), encoding="utf-8")
    first, second = tmp_path / "1.json", tmp_path / "2.json"
    for out in (first, second):
        assert cw.main(["--config", str(path), "--out", str(out), "--root", str(tree)]) == 0
    assert first.read_bytes() == second.read_bytes()
    text = first.read_text(encoding="utf-8")
    assert str(tree) not in text and str(tree.as_posix()) not in text


def test_the_table_lists_each_claim_with_its_evidence_and_citations(tree: Path) -> None:
    result, _ = cw.build(tree, planted_config())
    table = cw.render_table(result)
    lines = table.splitlines()
    assert lines[0] == "| id | claim | evidence | obligations it bears on |"
    assert "(invariant 1)" in lines[2] and "GDPR Art. 5(1)(f)" in lines[2]
    assert "`a.test.ts`: outer > inner > nested test" in lines[2]
    assert "**not evidenced**: no test checks it" in lines[3]


def test_write_table_replaces_only_the_marked_block(tmp_path: Path) -> None:
    doc = tmp_path / "doc.md"
    doc.write_text(f"intro\n{cw.TABLE_BEGIN}\nold\n{cw.TABLE_END}\nafter\n", encoding="utf-8")
    cw.write_table(doc, "| new |\n")
    text = doc.read_text(encoding="utf-8")
    assert text.startswith("intro\n") and text.endswith(f"{cw.TABLE_END}\nafter\n")
    assert "old" not in text
    assert cw.table_in(doc) == "| new |\n"


# The primary texts.

ACT = """<html><body>
<p>Article 5</p><p>Principles</p>
<p>1. Personal data shall be:</p>
<p>(a)</p><p>processed lawfully, fairly</p>
<p>(b)</p><p>the characteristics, including:</p>
<p>(i)</p><p>its intended purpose;</p>
<p>(iv)</p><p>information that is relevant to explain its output;</p>
<p>(c)</p><p>accurate</p>
<p>(f)</p><p>processed in a manner that ensures appropriate security of the personal data;</p>
<p>2. The controller shall be responsible for &#8216;accountability&#8217;.</p>
<p>Article 6</p><p>Lawfulness</p><p>1. Processing shall be lawful only if</p>
</body></html>"""


def test_locate_reads_one_article_paragraph_and_point() -> None:
    lines = cw.legal_lines(ACT)
    assert "appropriate security" in cw.locate(lines, "5", "1", "f")
    assert "lawfully" not in cw.locate(lines, "5", "1", "f")
    assert "explain its output" in cw.locate(lines, "5", "1", "b")
    assert "accurate" not in cw.locate(lines, "5", "1", "b")
    assert (
        cw.locate(lines, "5", "1", "b.iv")
        == "(iv) information that is relevant to explain its output;"
    )
    assert "explain" not in cw.locate(lines, "5", "1", "b.i")
    assert "accountability" in cw.locate(lines, "5", "2", None)
    assert "Lawfulness" not in cw.locate(lines, "5", "2", None)
    with pytest.raises(cw.ConfigError, match="no point"):
        cw.locate(lines, "5", "2", "z")
    with pytest.raises(cw.ConfigError, match="no Article 9"):
        cw.locate(lines, "9", "1", None)


def test_check_legal_needs_the_pinned_text_and_the_quote_in_its_place(tmp_path: Path) -> None:
    import hashlib

    (tmp_path / "gdpr.xhtml").write_bytes(ACT.encode())
    config = planted_config()
    assert cw.check_legal(config, tmp_path) == [
        "gdpr: gdpr.xhtml does not hash to the config's sha256"
    ]
    config["sources"]["gdpr"]["sha256"] = hashlib.sha256(ACT.encode()).hexdigest()
    config["obligations"][0]["heading"] = None
    assert cw.check_legal(config, tmp_path) == []
    moved = copy.deepcopy(config)
    moved["obligations"][0]["point"] = "a"
    assert cw.check_legal(moved, tmp_path) == ["GDPR-5-1-f: the quote is not in GDPR Art. 5(1)(a)"]


# The committed crosswalk.


def committed() -> tuple[dict[str, Any], list[str]]:
    return cw.build(REPO, load_config(CONFIG_PATH))


def test_every_test_the_committed_crosswalk_names_exists() -> None:
    _, missing = committed()
    assert missing == []


def test_the_committed_result_is_what_the_script_regenerates() -> None:
    result, _ = committed()
    assert RESULT_PATH.read_text(encoding="utf-8") == dumps_result(result)


def test_the_readme_table_is_what_the_script_generates() -> None:
    result, _ = committed()
    assert cw.table_in(README) == cw.render_table(result)


def test_the_readme_opens_by_saying_engram_supplies_evidence_not_compliance() -> None:
    text = README.read_text(encoding="utf-8")
    first = next(p for p in text.split("\n\n") if p.strip() and not p.startswith("#"))
    assert "evidence" in first and "does not make" in first and "compliant" in first


def test_every_committed_row_bears_on_a_cited_obligation_of_the_two_acts() -> None:
    config = load_config(CONFIG_PATH)
    assert set(config["sources"]) == {"ai-act", "gdpr"}
    for ob in config["obligations"]:
        assert ob["article"] and ob["paragraph"] and ob["quote"]
    for claim in config["claims"]:
        assert all(link["relation"] == "bears on" for link in claim["obligations"])
        assert claim["obligations"] or claim["unmapped"]


def test_every_committed_obligation_is_cited_by_a_claim() -> None:
    result, _ = committed()
    assert result["summary"]["obligations_without_claim"] == []
