"""The crosswalk (card R4): title parsing, the missing-test check, the config rules and the table.

The parser reads TypeScript test files as text, so it is checked on small
planted files: comments and strings blanked, nesting read from brackets,
constants, `+` joins, `.each` and `.for` rows as vitest formats them, calls
that are no evidence (skipped, todo, failing, conditional, an options skip, a
context skip) and tests enclosed in blocks that are not describes. Each probe
of the R4 review is a case here. The committed crosswalk is then checked as
it stands: every test it names is evidence, the committed result and the
README's table are what the script regenerates, and no row, nor the README,
claims to meet an obligation.
"""

from __future__ import annotations

import copy
import hashlib
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
const KINDS = ["model", "tool"] as const;

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
  test.each([[1.5, 2]])("%s floats", (a) => {});
  test.each(["model", "compaction"] as const)("a %s source is denied", (s) => {});
  test.each(KINDS)("a %s kind from a constant", (k) => {});
  test.each([1, 2])("number %i", (n) => {});
  test.each([{ a: "x", b: 2 }])("object $a and $b", ({ a }) => {});
  it.for(["p"])("for %s", (p) => {});
  test.each([[{ k: 1 }, "q"]])("json %j then %s", (o, s) => {});
  test.each(["first", "second"])("row %# is %s", (r) => {});
  test.each([["named", someActor]])("%s with an actor", (n, a) => {});
  test.each([[someActor, "x"]])("%s needs the actor", (a) => {});
});
test(`template ${1}`, () => {});
test(`a plain template`, () => {});
test("a \\"quoted\\" title", () => {});
const re = /it\\("in a regex"/;
const half = 1 / 2;
"""

# The probes of the R4 review: each is no evidence, or, marked last, evidence.
PROBES = {
    "line comment": ('// it("ghost", () => {});\n', []),
    "block comment": ('/*\ndescribe("outer", () => {\n  it("ghost", () => {});\n});\n*/\n', []),
    "inside a string": ("const s = 'it(\"ghost\", 1)';\n", []),
    "inside a template": ('const s = `\nit("ghost", () => {});\n`;\n', []),
    "skipped describe, none named": (
        'describe.skip("outer", () => {\n  it("ghost", () => {});\n});\n',
        [],
    ),
    "skipped inner describe, outer named": (
        'describe("outer", () => {\n  describe.skip("inner", () => {\n'
        '    it("ghost", () => {});\n  });\n});\n',
        ["outer"],
    ),
    "skipIf describe": (
        'describe.skipIf(true)("outer", () => {\n  it("ghost", () => {});\n});\n',
        [],
    ),
    "runIf describe": ('describe.runIf(ok)("outer", () => {\n  it("ghost", () => {});\n});\n', []),
    "it.skipIf": ('it.skipIf(true)("ghost", () => {});\n', []),
    "options skip": ('it("ghost", { skip: true }, () => {});\n', []),
    "options todo": ('it("ghost", { todo: true }, () => {});\n', []),
    "describe options skip": (
        'describe("outer", { skip: true }, () => {\n  it("ghost", () => {});\n});\n',
        [],
    ),
    "context skip": ('it("ghost", (ctx) => {\n  ctx.skip();\n});\n', []),
    "if (false)": ('if (false) {\n  it("ghost", () => {});\n}\n', []),
    "if inside a describe": (
        'describe("outer", () => {\n  if (cond) {\n    it("ghost", () => {});\n  }\n});\n',
        ["outer"],
    ),
    "a helper never called": ('function never() {\n  it("ghost", () => {});\n}\n', []),
    "a forEach callback": ('[1].forEach(() => {\n  it("ghost", () => {});\n});\n', []),
    "a loop around a describe": (
        'for (const b of B) {\n  describe("outer", () => {\n    it("ghost", () => {});\n  });\n}\n',
        ["outer"],
    ),
    "a describe's callback not its body": (
        'describe("outer", it("ghost", () => {}));\n',
        ["outer"],
    ),
}


def status(text: str, describe: list[str], it: str = "ghost", enclosed: bool = False) -> str:
    return cw.test_status(text, describe, it, enclosed)


# Titles.


def test_string_literals_of_every_quote_and_their_escapes() -> None:
    assert cw.string_at('"a\\"b" x', 0) == ('a"b', 6)
    assert cw.string_at("'it\\'s'", 0) == ("it's", 7)
    assert cw.string_at("`plain`", 0) == ("plain", 7)
    assert cw.string_at("`has ${x}`", 0) is None
    assert cw.string_at('"\\u00e9\\u{1F600}"', 0) == ("é\U0001f600", 17)
    assert cw.string_at('"unterminated\n"', 0) is None
    assert cw.string_at("x", 0) is None


def test_scan_blanks_comments_strings_and_regular_expressions_keeping_lines() -> None:
    text = 'a("x") // it("c")\n/* it("d") */ b(`t ${f("e")} u`, /\\(/g, 1 / 2);\n'
    src = cw.scan(text)
    assert len(src.masked) == len(text)
    assert src.masked.count("\n") == text.count("\n")
    assert "it" not in src.masked and '"c"' not in src.masked
    assert 'f("' in src.masked  # a substitution is code
    assert src.strings[2] == ("x", 5)
    assert src.strings[text.index("`")][0] is None
    assert "1 / 2" in src.masked  # a division is not a regular expression
    with pytest.raises(cw.Unparsed):
        cw.scan('a("unterminated\n')
    with pytest.raises(cw.Unparsed):
        cw.scan("a(b(c)")


def test_constants_and_joins_resolve_to_one_title() -> None:
    consts = cw.constants(cw.scan(SPEC))
    assert consts["LONG"] == "a title bound to a constant, joined over two literals"
    assert cw.title_at(cw.scan('f(A + " more")'), 2, {"A": "one"}) == "one more"
    assert cw.title_at(cw.scan("f(unknown, () => {})"), 2, {}) is None
    assert cw.title_at(cw.scan('f("a" + b(), x)'), 2, {}) is None


def titles() -> dict[tuple[str, str], cw.Call]:
    return {(c.kind, t): c for c in cw.calls(SPEC) for t in c.titles}


def test_calls_name_kind_title_and_modifiers() -> None:
    found = titles()
    assert ("describe", "inner") in found
    assert ("test", "a title on its own line") in found
    assert ("test", "a plain template") in found
    assert ("test", 'a "quoted" title') in found
    assert found[("test", "skipped")].modifiers == frozenset({"skip"})
    assert found[("test", "skipped")].blocked and found[("test", "to do")].blocked
    assert not any(t.startswith("template") for _, t in found)
    assert not any("in a regex" in t for _, t in found)


@pytest.mark.parametrize(
    "title",
    [
        "rejects in packages/core",
        "rejects in packages/adapters",
        "KEY=sk-1 x keeps KEY=<redacted> x",
        "y keeps z",
        "a model source is denied",
        "a compaction source is denied",
        "a model kind from a constant",
        "a tool kind from a constant",
        "number 1",
        "number 2",
        "object x and 2",
        "for p",
        'json {"k":1} then q',
        "row 0 is first",
        "row 1 is second",
        "named with an actor",
    ],
)
def test_each_and_for_rows_are_titled_as_vitest_titles_them(title: str) -> None:
    assert ("test", title) in titles()


def test_a_row_whose_needed_value_is_not_a_literal_has_no_title() -> None:
    found = titles()
    assert not any("needs the actor" in t for _, t in found)
    assert not any("floats" in t for _, t in found)


def test_format_title_follows_vitest() -> None:
    assert cw.format_title("%s and %d", ["a", True], 0) == "a and 1"
    assert cw.format_title("$name is $n", {"name": "x" * 45, "n": 3}, 0) == "x" * 39 + "… is 3"
    assert cw.format_title("$0 then $1", ["a", "b"], 0) == "a then b"
    assert cw.format_title("keeps $dollar", ["a"], 0) == "keeps $dollar"
    assert cw.format_title("%f", [1.5], 0) is None
    assert cw.format_title("100%% of %s", ["x"], 0) is None
    assert cw.format_title("%s %s", ["only one"], 0) is None


@pytest.mark.parametrize(
    ("describe", "it"),
    [
        (["outer", "inner"], "nested test"),
        (["outer", "inner"], "a title on its own line"),
        (["outer", "inner"], "a title bound to a constant, joined over two literals"),
        (["outer"], "outer only"),
        (["outer"], "nested test"),
        (["inner"], "nested test"),
        (["sibling"], "in sibling"),
        ([], "nested test"),
        ([], "rejects in packages/core"),
        (["rows"], "y keeps z"),
        ([], 'a "quoted" title'),
    ],
)
def test_find_test_finds_a_test_inside_the_named_describes(describe: list[str], it: str) -> None:
    assert cw.find_test(SPEC, describe, it)


@pytest.mark.parametrize(
    ("describe", "it", "expected"),
    [
        (["outer", "inner"], "outer only", "missing"),
        (["outer"], "in sibling", "missing"),
        (["sibling"], "nested test", "missing"),
        (["inner", "outer"], "nested test", "missing"),
        (["outer"], "y keeps z", "missing"),
        (["outer"], "skipped", "skipped"),
        (["outer"], "to do", "skipped"),
        ([], "rejects in packages/ui", "missing"),
        (["outer", "inner"], "nested", "missing"),
        ([], "inner", "missing"),
        ([], "in a regex", "missing"),
    ],
)
def test_find_test_refuses_a_test_outside_them_skipped_or_misnamed(
    describe: list[str], it: str, expected: str
) -> None:
    assert status(SPEC, describe, it) == expected


@pytest.mark.parametrize("probe", sorted(PROBES))
def test_no_review_probe_counts_as_evidence(probe: str) -> None:
    text, describe = PROBES[probe]
    assert not cw.find_test(text, describe, "ghost")


@pytest.mark.parametrize(
    ("probe", "expected"),
    [
        ("line comment", "missing"),
        ("inside a string", "missing"),
        ("skipped inner describe, outer named", "skipped"),
        ("runIf describe", "skipped"),
        ("options skip", "skipped"),
        ("context skip", "skipped"),
        ("if (false)", "enclosed"),
        ("a forEach callback", "enclosed"),
        ("a describe's callback not its body", "enclosed"),
    ],
)
def test_the_status_says_why_a_probe_is_not_evidence(probe: str, expected: str) -> None:
    text, describe = PROBES[probe]
    assert status(text, describe) == expected


def test_an_enclosed_test_counts_only_when_its_row_says_why_it_runs() -> None:
    text, describe = PROBES["a loop around a describe"]
    assert status(text, describe) == "enclosed"
    assert status(text, describe, enclosed=True) == "found"
    skipped, describe = PROBES["skipIf describe"]
    assert status(skipped, describe, enclosed=True) == "skipped"


def test_an_unparsed_file_is_no_evidence() -> None:
    assert status('it("ghost", () => {\n', []) == "unparsed"


def test_the_options_of_a_test_are_read_but_its_body_is_not() -> None:
    assert cw.find_test('it("ghost", { timeout: 5, skip: false }, () => {});\n', [], "ghost")
    assert cw.find_test('it("ghost", () => {\n  run({ skip: true });\n});\n', [], "ghost")


# The crosswalk on a planted tree.


def planted_config() -> dict[str, Any]:
    return {
        "name": "crosswalk",
        "statement": "evidence only",
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
                "heading": "Principles",
                "quote": "appropriate security of the personal data",
            }
        ],
        "claims": [
            {
                "id": "C1",
                "claim": "a read never returns an item outside the reader's scopes and grants",
                "source": "AGENTS.md",
                "invariant": 1,
                "limits": "the actor is self-asserted",
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
    (tmp_path / "loop.test.ts").write_text(PROBES["a loop around a describe"][0], encoding="utf-8")
    return tmp_path


def test_build_marks_a_claim_with_no_test_not_evidenced(tree: Path) -> None:
    result, missing = cw.build(tree, planted_config())
    assert missing == []
    assert [r["status"] for r in result["claims"]] == ["evidenced", "not evidenced"]
    assert result["summary"]["not_evidenced"] == ["C2"]
    assert result["obligations"][0]["claims"] == ["C1", "C2"]
    assert result["hypothesis"] == "none"


def test_build_reports_each_named_test_that_is_not_evidence_with_its_status(tree: Path) -> None:
    config = planted_config()
    config["claims"][0]["tests"] += [
        {"file": "a.test.ts", "describe": ["outer"], "it": "gone"},
        {"file": "a.test.ts", "describe": ["outer"], "it": "skipped"},
        {"file": "loop.test.ts", "describe": ["outer"], "it": "ghost"},
        {"file": "b.test.ts", "describe": [], "it": "x"},
    ]
    _, missing = cw.build(tree, config)
    assert missing == [
        "C1: no test a.test.ts > outer > gone (missing)",
        "C1: no test a.test.ts > outer > skipped (skipped)",
        "C1: no test loop.test.ts > outer > ghost (enclosed)",
        "C1: no file b.test.ts",
    ]


def test_an_enclosed_mark_names_the_block_and_reaches_the_result(tree: Path) -> None:
    config = planted_config()
    mark = {"file": "loop.test.ts", "describe": ["outer"], "it": "ghost", "enclosed": "a loop"}
    config["claims"][0]["tests"].append(mark)
    result, missing = cw.build(tree, config)
    assert missing == []
    assert result["claims"][0]["tests"][-1]["enclosed"] == "a loop"
    config["claims"][0]["tests"][-1]["enclosed"] = " "
    with pytest.raises(cw.ConfigError, match="enclosed says which block"):
        cw.validate(config)


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
    ("path", "value", "message"),
    [
        (["claims", 0, "obligations", 0, "relation"], "satisfies", "never another"),
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


@pytest.mark.parametrize(
    "why",
    [
        "the plane satisfies Article 12",
        "Satisfies Article 5",
        "Engram is compliant here",
        "ensures compliance with Article 12",
        "the plane makes a deployment comply with Article 17",
        "it complies with Article 17",
        "the deployer complied",
        "conforms to Article 12",
        "the deployer is in conformity",
        "meets Article 17 in full",
        "the plane meet the duty",
        "this test proves the obligation is met",
        "discharges the controller's duty",
        "the duty is discharged",
        "fulfils Article 5",
        "NON-COMPLIANT otherwise",
    ],
)
def test_validate_refuses_every_stem_of_a_compliance_claim(why: str) -> None:
    config = planted_config()
    config["claims"][0]["obligations"][0]["why"] = why
    with pytest.raises(cw.ConfigError, match="reads as a compliance claim"):
        cw.validate(config)


@pytest.mark.parametrize(
    "why",
    [
        "the adapter conformance suite runs on every store",
        "a record meeting replay_k of replay_n",
        "the metadata of an item",
        "a method of measurement",
        "each grant names whom it admits",
    ],
)
def test_ordinary_words_are_not_compliance_claims(why: str) -> None:
    config = planted_config()
    config["claims"][0]["obligations"][0]["why"] = why
    cw.validate(config)


def test_the_statement_and_method_are_checked_apart_from_the_listed_negations() -> None:
    config = planted_config()
    config["statement"] = "Engram supplies evidence; it does not make a deployment compliant."
    cw.validate(config)
    config["statement"] = "Engram makes a deployment compliant."
    with pytest.raises(cw.ConfigError, match="statement"):
        cw.validate(config)
    config["statement"] = "evidence only"
    config["method"] = "each claim meets a duty"
    with pytest.raises(cw.ConfigError, match="method"):
        cw.validate(config)


def test_a_quote_and_a_test_title_may_hold_any_word() -> None:
    config = planted_config()
    config["obligations"][0]["quote"] = "to demonstrate compliance with"
    config["claims"][0]["tests"][0]["it"] = "a record meets the floor"
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
    err = capsys.readouterr().err
    assert "missing C1: no test a.test.ts > outer > inner > renamed (missing)" in err


def test_main_writes_byte_stable_output_with_no_absolute_path(tree: Path, tmp_path: Path) -> None:
    path = tmp_path / "config.json"
    path.write_text(json.dumps(planted_config()), encoding="utf-8")
    first, second = tmp_path / "1.json", tmp_path / "2.json"
    for out in (first, second):
        assert cw.main(["--config", str(path), "--out", str(out), "--root", str(tree)]) == 0
    assert first.read_bytes() == second.read_bytes()
    text = first.read_text(encoding="utf-8")
    assert str(tree) not in text and str(tree.as_posix()) not in text


def test_main_refuses_a_table_file_whose_prose_claims_compliance(
    tree: Path, tmp_path: Path
) -> None:
    path = tmp_path / "config.json"
    path.write_text(json.dumps(planted_config()), encoding="utf-8")
    doc = tmp_path / "doc.md"
    doc.write_text(f"Engram is compliant.\n{cw.TABLE_BEGIN}\n{cw.TABLE_END}\n", encoding="utf-8")
    args = ["--config", str(path), "--out", str(tmp_path / "o.json"), "--root", str(tree)]
    assert cw.main([*args, "--table", str(doc)]) == 2
    assert cw.table_in(doc) == "\n"
    doc.write_text(f"It does not make a deployment compliant.\n{cw.TABLE_BEGIN}\n{cw.TABLE_END}\n")
    assert cw.main([*args, "--table", str(doc)]) == 0


def test_the_table_lists_each_claim_with_its_evidence_and_citations(tree: Path) -> None:
    result, _ = cw.build(tree, planted_config())
    table = cw.render_table(result)
    lines = table.splitlines()
    assert lines[0] == "| id | claim | evidence | obligations it bears on | limits |"
    assert "(invariant 1)" in lines[2] and "GDPR Art. 5(1)(f)" in lines[2]
    assert "`a.test.ts`: outer > inner > nested test" in lines[2]
    assert "**not evidenced**: no test checks it" in lines[3]
    assert lines[2].endswith("| the actor is self-asserted |")
    assert lines[3].endswith("|  |")


def test_write_table_replaces_only_the_marked_block(tmp_path: Path) -> None:
    doc = tmp_path / "doc.md"
    doc.write_text(f"intro\n{cw.TABLE_BEGIN}\nold\n{cw.TABLE_END}\nafter\n", encoding="utf-8")
    cw.write_table(doc, "| new |\n")
    text = doc.read_text(encoding="utf-8")
    assert text.startswith("intro\n") and text.endswith(f"{cw.TABLE_END}\nafter\n")
    assert "old" not in text
    assert cw.table_in(doc) == "| new |\n"
    assert "| new |" not in cw.prose(text)


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
<p>3. A third paragraph says the logs shall be kept.</p>
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


def test_locate_ends_a_paragraph_at_the_next_one() -> None:
    lines = cw.legal_lines(ACT)
    assert "logs shall be kept" in cw.locate(lines, "5", "3", None)
    assert "logs shall be kept" not in cw.locate(lines, "5", "1", None)
    assert "logs shall be kept" not in cw.locate(lines, "5", "2", None)


def pinned(tmp_path: Path) -> dict[str, Any]:
    (tmp_path / "gdpr.xhtml").write_bytes(ACT.encode())
    config = planted_config()
    config["sources"]["gdpr"]["sha256"] = hashlib.sha256(ACT.encode()).hexdigest()
    return config


def test_check_legal_needs_the_pinned_text_and_the_quote_in_its_place(tmp_path: Path) -> None:
    config = pinned(tmp_path)
    assert cw.check_legal(config, tmp_path) == []
    wrong = copy.deepcopy(config)
    wrong["sources"]["gdpr"]["sha256"] = "0"
    assert cw.check_legal(wrong, tmp_path) == [
        "gdpr: gdpr.xhtml does not hash to the config's sha256"
    ]
    moved = copy.deepcopy(config)
    moved["obligations"][0]["point"] = "a"
    assert cw.check_legal(moved, tmp_path) == ["GDPR-5-1-f: the quote is not in GDPR Art. 5(1)(a)"]


def test_check_legal_refuses_a_paragraph_3_quote_cited_as_paragraph_1(tmp_path: Path) -> None:
    config = pinned(tmp_path)
    ob = config["obligations"][0]
    ob.update(paragraph="3", point=None, quote="the logs shall be kept")
    assert cw.check_legal(config, tmp_path) == []
    ob["paragraph"] = "1"
    assert cw.check_legal(config, tmp_path) == ["GDPR-5-1-f: the quote is not in GDPR Art. 5(1)"]


def test_check_legal_reads_the_heading_of_the_cited_article_only(tmp_path: Path) -> None:
    config = pinned(tmp_path)
    config["obligations"][0]["heading"] = "Lawfulness"  # Article 6's heading, not Article 5's
    assert cw.check_legal(config, tmp_path) == [
        "GDPR-5-1-f: Article 5's heading is 'Principles', not 'Lawfulness'"
    ]


# The committed crosswalk.


def committed() -> tuple[dict[str, Any], list[str]]:
    return cw.build(REPO, load_config(CONFIG_PATH))


def test_every_test_the_committed_crosswalk_names_is_evidence() -> None:
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


def test_the_readme_prose_claims_no_compliance() -> None:
    text = README.read_text(encoding="utf-8")
    assert cw.forbidden_words(cw.prose(text), cw.NEGATIONS) == []


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
