"""Edge-case golden outputs from GateMem's own code, for the port's fidelity test (finding R6-1, R6-12).

The fixture's scripted answers are plain strings, so they never exercise the
places where Python and JavaScript differ: numbers in a model's JSON (2.0 is a
float in Python and prints as 2.0), str() of a dict (single quotes), key order,
strings json.dumps leaves unescaped, and regular expressions on non-ASCII text
(Python's \\w, \\s, \\d and \\b are Unicode-aware, its $ also matches before a
final newline, its . matches \\r). This script runs upstream's own parsing
(generate_llm_output with a fake router), flatten_output_text and pattern_hits
on crafted inputs and records what they return. Development time only:

    python -I packages/bench/scripts/upstream-edge-golden.py \
        --upstream <dir with GateMem files at a983828> \
        --out fixtures/bench/gatemem/upstream-edge-golden.json

packages/bench/test/gatemem/edge.test.ts holds the port to the file.
"""

from __future__ import annotations

import argparse
import json
import sys
import types
from pathlib import Path
from typing import Any

# Raw model texts. Each is parsed as upstream's real-provider path parses it.
PARSE_CASES: list[str] = [
    '{"action":"answer","answer":"x","answer_structured":{"dose_mg":2.0,"count":2,"ratio":0.5}}',
    '{"action":"answer","answer":"x","answer_structured":{"big":1e16,"small":1e-05,"tiny":1.5e-7,"mid":123456.789}}',
    '{"action":"answer","answer":"x","answer_structured":{"e":1E2,"neg":-0.0,"zero":0,"negzero":-0,"inf":1e400}}',
    '{"action":"answer","answer":"x","answer_structured":{"n":12345678901234567890,"f":0.1,"g":100.0,"h":1e15,"k":12345678901234567.0}}',
    '{"action":"answer","answer":"x","answer_structured":{"z":1,"a":{"y":[1,2.5,"s"],"b":null,"c":true}}}',
    '{"action":"answer","answer":"x","answer_structured":{"2":"two","10":"ten","b":"bee","1":"one"}}',
    '{"action":"answer","answer":"x","answer_structured":{"\\u00e9":"caf\\u00e9","\\ud83d\\ude00":"smile","\\uff21":"wide","Z":"z"}}',
    '{"action":"answer","answer":"x","answer_structured":{"ctl":"a\\u0001b\\u007fc\\u2028d","q":"say \\"hi\\" \\\\ / done"}}',
    '{"action":"answer","answer":{"b":1,"a":2.0,"s":"it\'s"},"answer_structured":{}}',
    '{"action":"answer","answer":[1,2.0,"x",null,true,{"k":"v"}],"answer_structured":{}}',
    '{"action":"answer","answer":"x","answer_structured":{},"used_record_ids":[1,2.0,"r3",null,false,1e20]}',
    '{"action":"answer","answer":3.50,"answer_structured":"{\\"price\\": 3.50}"}',
    '{"action":"answer","answer":"x","answer_structured":{"nan":NaN,"pinf":Infinity,"ninf":-Infinity}}',
    '{"action":"answer","answer":"x","answer_structured":{"k":1,"k":2.0}}',
    '{"action":"answer","answer":{"q":"say \\"hi\\"","n":"line\\nbreak\\ttab","u":"caf\\u00e9\\u0085\\u00a0"},"answer_structured":{}}',
    '{"action":"answer","answer":"\\u00a0padded\\u00a0","answer_structured":{"s":"\\u001c"}}',
    # Not JSON: upstream's ast.literal_eval fallback (round 2, defect 7). Python
    # literals the port reproduces: single quotes, None, True, False, tuples,
    # escapes, raw and concatenated strings, comments, any int or float form.
    "{'action': 'refuse', 'answer': 'no', 'answer_structured': {'a': 1.0, 'b': (1, 2), 'c': None, 'd': True}}",
    "{'action': 'answer', 'answer': {'t': (1, 2.50), 'one': (1,), 'none': ()}, 'answer_structured': {'h': 0x10, 'u': 1_000, 'o': 0o17, 'b': 0b1_0}}",
    "{'action': 'answer', 'answer': 'x', 'answer_structured': \"{'q': 2.0, 't': ('a', [1])}\"}",
    "{'action': 'answer', 'answer': 'x', 'answer_structured': {}, 'used_record_ids': ('r1', 'r2')}",
    "{'action': 'answer', 'answer': 'x', 'answer_structured': {}, 'used_record_ids': ['r1', 2, 2.0, None, ('t',)]}",
    "{'action': 'answer_redacted', 'answer': \"it's \\\"quoted\\\" \\\\ back\", 'answer_structured': {'k': 'caf\\xe9 \\u00e9 \\U0001F600 \\101 \\0 \\a \\q'}}",
    "{'action': 'answer', 'answer': r'raw \\n stays' ' and ' \"joined\", 'answer_structured': {'tq': '''multi\nline''', 'e': ''}}",
    "{\n  # a comment, then a trailing comma\n  'action': 'answer',\n  'answer': 'x',\n  'answer_structured': {'f': [1., .5, 1_0.5, 1e5, 1.5E-3, -0.0, -(1), - 2, +3, 12345678901234567890, 1e400]},\n}",
    "{'action': 'answer', 'answer': 'x', 'answer_structured': {'b': 2, 'a': 1, 'b': 3, 'z': {'y': None, 'x': False}}}",
    "{'action':\r\n 'answer',\r\n 'answer': '''a\r\nb''', 'answer_structured': {'s': 'x\\\r\ny'}}",
    '{"action": "refuse", "answer": None, "answer_structured": {"n": True}}',
    "Sure: {'action': 'answer', 'answer': 'x', 'answer_structured': {}} trailing",
    '{"action":"answer","answer":"x","answer_structured":"# {c}\\n{\'k\': 1}"}',
    '{"action":"answer","answer":"x","answer_structured":"# {c}\\n  {\'k\': 1}"}',
    # Literals upstream's literal_eval rejects: it returns None and the reply is
    # read as plain text, as the port must do too.
    "{'action': 'refuse', 'answer': true}",
    "{'action': 'refuse', 'answer': foo}",
    "{'action': 'refuse', 'answer': 1 + 2}",
    "{'action': 'refuse', 'answer': -(-1)}",
    "{'action': 'refuse', 'answer': +True}",
    "{'action': 'refuse', 'answer': f'x'}",
    "{'action': 'refuse', 'answer': ur'x'}",
    "{'action': 'refuse', 'answer': 'unterminated}",
    "{'action': 'refuse', 'answer': 'x'}\n x {}",
    "{{'action': 'refuse'}}",
    "{'action': 'refuse', 'answer': [1 2]}",
    "{'action': 'refuse', 'answer': 0777}",
    "{'action': 'refuse', 'answer': '\\x4'}",
    "{'action': 'refuse', 'answer':  1}",
    "{'action': 'refuse', 'answer': '\\U00110000'}",
    "{'action': 'refuse', [1]: 2}",
    "{'action': 'refuse', 'answer': {[1]}}",
    "{'action': 'refuse', 'answer': b'x' 'y'}",
    "{'action': 'refuse', 'answer': 'x'.upper}",
    "{'action': 'refuse', 'answer': 'x'} \\\n",
    "{'action': 'refuse'}, {'answer': 'x'}",
    "{'action': 'refuse', 'answer': '\ud800'}",
    "{'action': 'refuse', 'answer': 1__0}",
    "{'action': 'refuse', 'answer': 'x' # unclosed}",
]

# Valid Python literals outside the subset the port reproduces (sets, bytes,
# complex numbers, Ellipsis, \N{...} escapes, keys other than str): upstream
# parses them; the port must throw rather than read the reply differently.
UNTRANSLATABLE_PARSE_CASES: list[str] = [
    "{'action': 'answer', 'answer': {'t': (1, 2.50), 's': {3, 1}}, 'answer_structured': {'h': 0x10, 'u': 1_000}}",
    "{'action': 'answer', 'answer': 'x', 'answer_structured': {'z': 1j, 'b': b'by'}}",
    "{'action': 'answer', 'answer': 'x', 'answer_structured': {'e': ...}}",
    "{'action': 'answer', 'answer': '\\N{BULLET}', 'answer_structured': {}}",
    "{'action': 'answer', 'answer': 'x', 'answer_structured': {1: 'one'}}",
    "{'action': 'answer', 'answer': set(), 'answer_structured': {}}",
    "{'action': 'answer', 'answer': 'x', 'answer_structured': {'c': -1 + 2j}}",
]

# (text, pattern) pairs for pattern_hits.
PATTERN_CASES: list[tuple[str, str]] = [
    ("résumé sent", "sum"),
    ("café open", "caf"),
    ("the café is open", r"caf\w"),
    ("naïve plan", r"\bna\w+ve\b"),
    ("xéy", r"x\Wy"),
    ("dose two mg", r"dose\stwo"),
    ("dose two mg", "dose two"),
    ("dose\x1ctwo", r"dose\stwo"),
    ("dose\x1ctwo", "dose two"),
    ("dose﻿two", r"dose\stwo"),
    ("room ٣٤", r"room \d+"),
    ("room 34", r"room \d+"),
    ("ends here\n", r"here$"),
    ("ends here\n", r"here\Z"),
    ("ends here", r"here\Z"),
    ("ends here\n", r"(here)$"),
    ("here\nthere", r"(here)$"),
    ("a\rb", r"(a.b)"),
    ("a\rb", r"a.b"),
    ("a b", r"a.b"),
    ("Visa 4111", r"(?i)visa \d{4}"),
    ("count {3}", r"count {3}"),
    ("count {x}", r"count {x}"),
    ("a,b", r"a\,b"),
    ("a-b", r"a\-b"),
    ("STRASSE", "straße"),
    ("ſecret code", r"secret"),
    ("Key 9", r"key \d"),
    ("x]y", r"x]y"),
    ("tab\there", r"tab\there"),
    ("a1b", r"a[\d]b"),
    ("a b", r"a[\s]b"),
    ("a b", r"a[\s]b"),
    ("été", r"^\w+$"),
    ("paren (x", r"paren (x"),
    ("phone 555-0100", r"555-0100"),
    ("Phone 555 0100", r"phone\s+555"),
    ("phone 555/0100 ext.12:30", "555/0100 ext.12:30"),
    ("call dr. lee", "dr. lee"),
    ("CALL Dr.  Lee", "dr. lee"),
    # Case-insensitive matching of non-ASCII text (round 2, R6-12): Python
    # compares the simple lowercase of each character, plus the equivalences
    # in re/_casefix.py, where JavaScript's i flag compares case folds.
    ("İstanbul", r"(?i)istanbul"),
    ("istanbul", r"(?i)İstanbul"),
    ("ıstanbul", r"(?i)istanbul"),
    ("ISTANBUL", r"(?i)ıstanbul"),
    ("istanbul", "ıstanbul"),
    ("ırmak", "irmak"),
    ("İzmir", "izmir"),
    ("K", r"(?i)k"),
    ("k", r"(?i)K"),
    ("ſ", r"(?i)S"),
    ("ΣΑΣ", r"(?i)σας"),
    ("ϐ", r"(?i)Β"),
    ("µ", r"(?i)Μ"),
    ("ﬅ", r"(?i)ﬆ"),
    ("ẞ", r"(?i)ß"),
    ("ß", r"(?i)SS"),
    ("Ꭰ", r"(?i)ꭰ"),
    ("Ⅳ", r"(?i)ⅳ"),
    ("Ⓐ", r"(?i)ⓐ"),
    ("ǅ", r"(?i)ǆ"),
    ("ǅ", r"(?i)Ǆ"),
    ("ͅ", r"(?i)ι"),
    ("𐐀", r"(?i)𐐨"),
    ("𐐀", r"(?i)[𐐨x]"),
    ("İ", r"(?i)[a-z]"),
    ("ı", r"(?i)[a-z]"),
    ("ı", r"(?i)[^i]"),
    ("ı", r"(?i)[^i\d]"),
    ("K", r"(?i)[j-l]"),
    ("ſ", r"(?i)[r-t]"),
    ("A", r"(?i)[^a]"),
    ("É", r"(?i)caf[é]"),
    ("CAFÉ", r"(?i)caf[é]"),
    ("CAFÉ", r"(?i)caf[\wé]"),
    ("x-y", r"[\w-]"),
    ("x", r"[\w-a]"),
    ("Istanbul", r"(?i:istanbul)"),
    ("ABC", r"(?-i:abc)"),
    ("ABC", r"(?i)a(?-i:b)c"),
    ("AbC", r"(?i)a(?-i:b)c"),
]

# Patterns whose case-insensitive meaning the port cannot reproduce exactly:
# it must throw UntranslatablePattern rather than match differently. A back
# reference under IGNORECASE compares lowercase forms (sre's
# GROUPREF_UNI_IGNORE), which no JavaScript construct does; pattern_hits
# always searches with IGNORECASE, so every back reference lands here. None of
# GateMem's 7,652 patterns at the pinned commit has one.
UNTRANSLATABLE_PATTERN_CASES: list[tuple[str, str]] = [
    ("id A-17 ok", r"(?P<tag>[A-Z])-(?P=tag)?17"),
    ("aA", r"(?i)(a)\1"),
    ("aA", r"(?i)(?P<x>a)(?P=x)"),
    ("𐐀", r"(?i)[\U00010428-\U00010429]"),
]


def _install_stubs(upstream: Path) -> None:
    for name, sub in [
        ("bench", "bench"),
        ("bench.agents", "bench/agents"),
        ("bench.eval", "bench/eval"),
        ("bench.llm", "bench/llm"),
    ]:
        mod = types.ModuleType(name)
        mod.__path__ = [str(upstream / sub)]
        sys.modules[name] = mod
    sys.path.insert(0, str(upstream))


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--upstream", required=True)
    p.add_argument("--out", required=True)
    args = p.parse_args()
    _install_stubs(Path(args.upstream).resolve())

    from bench.agents.utils_llm import generate_llm_output
    from bench.eval.metrics import flatten_output_text, pattern_hits
    from bench.llm.types import LLMCallResult

    class Router:
        provider = "scripted"
        text = ""

        def complete_result(self, *, system_prompt: str, user_prompt: str) -> Any:
            return LLMCallResult(
                text=self.text, provider="scripted", model="scripted-1", latency_s=0.0, usage={}
            )

    router = Router()

    def parse_row(raw: str) -> dict[str, Any]:
        router.text = raw
        out = generate_llm_output(
            query_text="q",
            retrieved_text="",
            query_type="utility",
            expected_action="answer",
            system_prompt="s",
            user_prompt="u",
            llm_router=router,
        )
        return {
            "raw": raw,
            "action": out["action"],
            "answer": out["answer"],
            "used_record_ids": out["used_record_ids"],
            "flattened": flatten_output_text(out),
        }

    parse_rows = [parse_row(raw) for raw in PARSE_CASES]
    pattern_rows = [
        {"text": t, "pattern": pat, "hits": pattern_hits(t, pat)} for t, pat in PATTERN_CASES
    ]
    golden = {
        "source": "packages/bench/scripts/upstream-edge-golden.py",
        "upstream_commit": "a983828b3bb7565e16e25ac8cdc2fc1982633b0b",
        "python": sys.version.split()[0],
        "parse": parse_rows,
        "patterns": pattern_rows,
        # What upstream returns where the port throws instead, for the record.
        "parse_untranslatable": [parse_row(raw) for raw in UNTRANSLATABLE_PARSE_CASES],
        "patterns_untranslatable": [
            {"text": t, "pattern": pat, "hits": pattern_hits(t, pat)}
            for t, pat in UNTRANSLATABLE_PATTERN_CASES
        ],
    }
    with open(args.out, "w", encoding="utf-8", newline="\n") as f:
        f.write(json.dumps(golden, indent=2, ensure_ascii=True) + "\n")
    print(
        f"wrote {len(parse_rows)} parse rows, {len(pattern_rows)} pattern rows and "
        f"{len(UNTRANSLATABLE_PARSE_CASES) + len(UNTRANSLATABLE_PATTERN_CASES)} untranslatable rows to {args.out}"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
