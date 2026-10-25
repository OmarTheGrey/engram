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
    ("id A-17 ok", r"(?P<tag>[A-Z])-(?P=tag)?17"),
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
    parse_rows = []
    for raw in PARSE_CASES:
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
        parse_rows.append(
            {
                "raw": raw,
                "action": out["action"],
                "answer": out["answer"],
                "used_record_ids": out["used_record_ids"],
                "flattened": flatten_output_text(out),
            }
        )
    pattern_rows = [
        {"text": t, "pattern": pat, "hits": pattern_hits(t, pat)} for t, pat in PATTERN_CASES
    ]
    golden = {
        "source": "packages/bench/scripts/upstream-edge-golden.py",
        "upstream_commit": "a983828b3bb7565e16e25ac8cdc2fc1982633b0b",
        "python": sys.version.split()[0],
        "parse": parse_rows,
        "patterns": pattern_rows,
    }
    with open(args.out, "w", encoding="utf-8", newline="\n") as f:
        f.write(json.dumps(golden, indent=2, ensure_ascii=True) + "\n")
    print(f"wrote {len(parse_rows)} parse rows and {len(pattern_rows)} pattern rows to {args.out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
