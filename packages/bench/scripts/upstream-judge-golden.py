"""Golden outputs of GateMem's own LLM judge code, for the judge port's fidelity test (card B1, PR 6).

Two parts, both from upstream's code at the pinned commit:

1. `parse_cases`: crafted judge replies through upstream's
   `_parse_judge_from_text`, `_coerce_judge_tri_bool` and `_redact_notes`
   (bench/eval/judge.py), as `_judge_one` applies them: JSON, fences, prose,
   Python literals, the key: value regex fallback with its MULTILINE and
   IGNORECASE flags, string and number booleans, and notes redaction.
   `redact_cases` runs `_redact_notes` alone.
2. `runs`: upstream's `run_llm_judge` on the fixture subset, with upstream's
   own predictions (from upstream-golden.json) and a fake router that answers
   from judge-script.json by checkpoint and attempt, with and without
   gate_by_action; per row the sha256 of every attempt's prompt and whether
   it asked for structured output, the judge object, and the summary, plus
   score_predictions.py's `_promote_judge_metrics` over upstream's
   rule-based summary.

Development time only:

    python -I packages/bench/scripts/upstream-judge-golden.py \
        --upstream <dir with GateMem files at a983828> \
        --fixtures fixtures/bench/gatemem \
        --out fixtures/bench/gatemem/upstream-judge-golden.json

packages/bench/test/gatemem/judge.test.ts holds the port to the file. Only
the modules it needs are loaded: package __init__ files are replaced by empty
modules, bench.llm gets the real router class, and bench.eval.runner and
bench.eval.validator, which score_predictions.py imports but the judge does
not use, are stubbed.
"""

from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import sys
import tempfile
import types
from pathlib import Path
from typing import Any

PARSE_CASES: list[str] = [
    '{"action_ok": true, "utility_ok": null, "privacy_leak": false, "deletion_leak": null, "notes": "ok"}',
    '```json\n{"action_ok": false, "utility_ok": true, "privacy_leak": null, "deletion_leak": null, "notes": "fenced"}\n```',
    "Verdict follows. {\"action_ok\": true, \"utility_ok\": false} and that is all.",
    "{}",
    "[]",
    '[{"action_ok": true}]',
    "action_ok: true\nutility_ok: false\nprivacy_leak: null",
    "action_ok: true\nutility_ok: false",
    "action_ok: true\nnotes: two fields and notes",
    "action_ok: true\nutility_ok: false\nnotes: two fields and notes",
    "ACTION_OK = False\r\nUtility_OK: TRUE \r\nprivacy_leak:none\r\nnotes:  spaced notes  \r\n",
    "action_oK: true\nutility_oK: true\nprivacy_leak: falſe\ndeletion_leak: null",
    "action_ok:\ntrue\nutility_ok: true\nprivacy_leak: true",
    "notes: first\nnote: second\naction_ok: true\nutility_ok: true\nprivacy_leak: true",
    "Sure! action_ok: true\nutility_ok: true\nprivacy_leak: true\ndeletion_leak: true",
    "action_ok : true  \nutility_ok :false\nprivacy_leak:null\ndeletion_leak: NULL\nnote = short",
    "action_ok: true\nutility_ok: true\nprivacy_leak: true",
    "action_ok: true utility_ok: true privacy_leak: true deletion_leak: true",
    "action_ok: true\rutility_ok: true\rprivacy_leak: true",
    # Two fields on lines of their own, a third and fourth split by a line
    # break Python's MULTILINE does not know: two fields, so no parse.
    "action_ok: true\nutility_ok: true\nprivacy_leak: true deletion_leak: false",
    "action_ok: true\nutility_ok: true\nprivacy_leak: true\rdeletion_leak: false",
    "action_ok: true\nutility_ok: true\nprivacy_leak: true deletion_leak: false\u0085",
    "  action_ok: yes\nutility_ok: no\nprivacy_leak: maybe\ndeletion_leak: false",
    "action_ok: true # sure\nutility_ok: true\nprivacy_leak: true\ndeletion_leak: false",
    "action_ok: True\nutility_ok: None\nprivacy_leak: NONE\ndeletion_leak: nUlL\nnotes:",
    "action_ok: true\nutility_ok: true\nprivacy_leak: true\nnotes: id 123456 leaked ٣٤ and AB-CDEF1",
    '{"action_ok": 2, "utility_ok": 0.0, "privacy_leak": -0.0, "deletion_leak": NaN, "notes": 12345}',
    '{"action_ok": "TRUE ", "utility_ok": " y", "privacy_leak": "N", "deletion_leak": "1", "notes": null}',
    '{"action_ok": "0", "utility_ok": "none", "privacy_leak": "n/a", "deletion_leak": "na", "notes": ""}',
    '{"action_ok": "", "utility_ok": "maybe", "privacy_leak": [], "deletion_leak": {"a": 1}, "notes": [1, 2]}',
    '{"action_ok": [1], "utility_ok": "False", "privacy_leak": "No", "deletion_leak": "YES", "notes": {"k": "v"}}',
    '{"action_ok": 1e400, "utility_ok": -1, "privacy_leak": 0, "deletion_leak": 12345678901234567890, "notes": false}',
    '{"action_ok": true, "action_ok": false, "utility_ok": null, "privacy_leak": null, "deletion_leak": null, "notes": "dup"}',
    "{'action_ok': True, 'utility_ok': None, 'privacy_leak': False, 'deletion_leak': (1,), 'notes': 'python literal'}",
    "{'action_ok': True, 'utility_ok': None, 'privacy_leak': 0, 'deletion_leak': 'None', 'notes': 3.0}",
    '{"action_ok": true, "utility_ok": null, "privacy_leak": null, "deletion_leak": null, "notes": "'
    + ("long note with ID ABCDEF and 77 " * 8)
    + '\\ud83d\\ude00 tail"}',
    '{"action_ok": "\\u00a0true\\u2003", "utility_ok": "\\u0130", "privacy_leak": "\\u0131", "deletion_leak": "\\u017f", "notes": "x"}',
    "",
    "   \n  ",
    "no verdict at all",
]

REDACT_CASES: list[str] = [
    "",
    "   ",
    "leaked identifier",
    "ids AB-1234 and 9 and 42 and ABCDEF and abcdef12 and X-Y-Z-W-1",
    "number 12, 1234567 and 3.14159",
    "arabic ٣٤ and devanagari १२ digits",
    "café A1B2C3 ÉABCDEF -ABCDEF- ABCDE",
    "MRN-00123 / SSN 123-45-6789 / ACCT_998877",
    "under_score_1234 x99y",
    " padded notes　",
    "a" * 200,
    "\U0001f600" * 170,
    "ABCDEF\nGHIJKL 12\n34",
]


# Agent outputs for the prompt's formatting: str() of a non-string answer,
# json.dumps(sort_keys=True) of the structured answer (floats, non-ASCII,
# nested keys), and Python's `or` on empty and falsy values.
PROMPT_OUTPUTS: list[dict[str, Any]] = [
    {"action": "answer", "answer": "plain", "answer_structured": {}},
    {
        "action": "answer",
        "answer": {"b": 1, "a": 2.0, "s": "it's"},
        "answer_structured": {"z": [1, 2.5, "\u00e9"], "a": {"y": None, "x": True}},
    },
    {"action": "answer_redacted", "answer": ["x", 1.0, None], "answer_structured": {"k": 1e16, "small": 1e-05}},
    {"action": None, "answer": 0, "answer_structured": None},
    {"action": "", "answer": "", "answer_structured": []},
    {"action": "  refuse  ", "answer": "caf\u00e9 {query_type} \u2028 end", "answer_structured": {"q": 'say "hi"'}},
    {},
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
    from bench.llm.router import LLMRouter

    sys.modules["bench.llm"].LLMRouter = LLMRouter  # type: ignore[attr-defined]
    runner = types.ModuleType("bench.eval.runner")
    runner.dump_jsonl = lambda *a, **k: None  # type: ignore[attr-defined]
    runner.load_jsonl = lambda *a, **k: []  # type: ignore[attr-defined]
    sys.modules["bench.eval.runner"] = runner
    validator = types.ModuleType("bench.eval.validator")
    validator.validate_dataset = lambda *a, **k: ([], [])  # type: ignore[attr-defined]
    sys.modules["bench.eval.validator"] = validator


def _sha(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def _load_jsonl(path: Path) -> list[dict[str, Any]]:
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--upstream", required=True)
    p.add_argument("--fixtures", required=True)
    p.add_argument("--out", required=True)
    args = p.parse_args()
    upstream = Path(args.upstream).resolve()
    fixtures = Path(args.fixtures).resolve()
    _install_stubs(upstream)

    from bench.eval import judge as J
    from bench.eval.scorer import score_predictions
    from bench.llm.types import LLMCallResult

    spec = importlib.util.spec_from_file_location(
        "score_predictions", upstream / "bench" / "scripts" / "score_predictions.py"
    )
    assert spec and spec.loader
    sp = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(sp)

    def verdict(raw: str) -> dict[str, Any]:
        parsed, ok, mode = J._parse_judge_from_text(raw)
        return {
            "raw": raw,
            "parse_ok": bool(ok),
            "parse_mode": mode if ok else None,
            "parse_error": None if ok else str(mode or "judge_output_not_parseable_as_structured_json"),
            "action_ok_llm": J._coerce_judge_tri_bool(parsed.get("action_ok")),
            "utility_ok": J._coerce_judge_tri_bool(parsed.get("utility_ok")),
            "privacy_leak": J._coerce_judge_tri_bool(parsed.get("privacy_leak")),
            "deletion_leak": J._coerce_judge_tri_bool(parsed.get("deletion_leak")),
            "notes": J._redact_notes(str(parsed.get("notes") or "")),
        }

    parse_cases = [verdict(raw) for raw in PARSE_CASES]
    redact_cases = [{"notes": s, "redacted": J._redact_notes(s)} for s in REDACT_CASES]

    script = json.loads((fixtures / "judge-script.json").read_text(encoding="utf-8"))["responses"]
    golden_b1 = json.loads((fixtures / "upstream-golden.json").read_text(encoding="utf-8"))
    predictions = [{"checkpoint_id": r["checkpoint_id"], "output": r["output"]} for r in golden_b1["rows"]]
    episodes: list[dict[str, Any]] = []
    checkpoints: list[dict[str, Any]] = []
    for domain_dir in sorted(d for d in fixtures.iterdir() if (d / "episodes.jsonl").exists()):
        episodes += _load_jsonl(domain_dir / "episodes.jsonl")
        checkpoints += _load_jsonl(domain_dir / "checkpoints.jsonl")
    by_question: dict[tuple[str, str, str], str] = {}
    for c in checkpoints:
        key = (c["as_of_turn_id"], c["asker"]["principal_id"], c["query_text"])
        assert key not in by_question, key
        by_question[key] = c["checkpoint_id"]

    def checkpoint_of(prompt: str) -> str:
        lines = prompt.split("\n")
        field = {
            name: next(ln[len(name) + 2 :] for ln in lines if ln.startswith(name + ": "))
            for name in ("as_of_turn_id", "requester", "question")
        }
        principal = field["requester"].split(" (", 1)[0]
        return by_question[(field["as_of_turn_id"], principal, field["question"])]

    seen: dict[str, list[dict[str, Any]]] = {}

    class ScriptedJudgeRouter:
        provider = "scripted"
        config = types.SimpleNamespace(model="judge-1")

        def complete_result(self, *, system_prompt: str, user_prompt: str, **kwargs: Any) -> Any:
            assert system_prompt == ""
            structured = kwargs.get("json_schema") is not None
            if structured:
                assert kwargs["json_schema"] == J._JUDGE_JSON_SCHEMA
                assert kwargs["json_schema_name"] == "benchmark_judge"
            suffixed = user_prompt.endswith(J._STRUCTURED_JUDGE_RETRY_SUFFIX)
            attempt = 3 if not structured else (2 if suffixed else 1)
            cid = checkpoint_of(user_prompt)
            seen.setdefault(cid, []).append(
                {"attempt": attempt, "structured": structured, "prompt_sha256": _sha(user_prompt)}
            )
            reply = script[cid]
            text = reply if isinstance(reply, str) else reply[min(attempt, len(reply)) - 1]
            return LLMCallResult(text=text, provider="scripted", model="judge-1", latency_s=0.0, usage={})

    prompt_path = str(upstream / "bench" / "prompts" / "judge_prompt.txt")
    first_prompt: dict[str, str] = {}
    runs: dict[str, Any] = {}
    for gate in (False, True):
        seen.clear()
        with tempfile.TemporaryDirectory() as tmp:
            rows, summary = J.run_llm_judge(
                episodes=episodes,
                checkpoints=checkpoints,
                predictions=predictions,
                judge_router=ScriptedJudgeRouter(),
                prompt_path=prompt_path,
                out_path=str(Path(tmp) / "judge_scores.jsonl"),
                gate_by_action=gate,
                concurrency=1,
            )
        _, rule_summary = score_predictions(
            episodes=episodes, checkpoints=checkpoints, predictions=predictions, gate_by_action=gate
        )
        promoted = sp._promote_judge_metrics(rule_summary, summary)
        if not gate:
            # The first attempt's full prompt for one checkpoint, so a mismatch is readable.
            cid0 = rows[0]["checkpoint_id"]
            tmpl = Path(prompt_path).read_text(encoding="utf-8")
            assert tmpl
            first_prompt = {"checkpoint_id": cid0, "sha256": seen[cid0][0]["prompt_sha256"]}
        summary = {k: v for k, v in summary.items() if k not in ("llm", "prompt_path")}
        runs["gated" if gate else "ungated"] = {
            "rows": [
                {
                    "checkpoint_id": r["checkpoint_id"],
                    "episode_id": r["episode_id"],
                    "query_type": r["query_type"],
                    "judge": r["judge"],
                    "structured_request": r["llm"]["structured_request"],
                    "calls": seen[r["checkpoint_id"]],
                }
                for r in rows
            ],
            "summary": summary,
            "promoted": {
                k: promoted[k]
                for k in (
                    "n_checkpoints",
                    "n_utility",
                    "action_accuracy",
                    "utility_accuracy",
                    "privacy_leakage_rate",
                    "deletion_leakage_rate",
                    "privacy_answer_leakage_rate",
                    "deletion_answer_leakage_rate",
                    "over_refusal_rate",
                    "compliance_utility_score",
                )
            },
        }

    # The first checkpoint judged against each crafted output: the prompt of attempt 1.
    prompt_cases: list[dict[str, Any]] = []
    cid0 = predictions[0]["checkpoint_id"]
    for output in PROMPT_OUTPUTS:
        seen.clear()
        with tempfile.TemporaryDirectory() as tmp:
            J.run_llm_judge(
                episodes=episodes,
                checkpoints=checkpoints,
                predictions=[{"checkpoint_id": cid0, "output": output}],
                judge_router=ScriptedJudgeRouter(),
                prompt_path=prompt_path,
                out_path=str(Path(tmp) / "judge_scores.jsonl"),
            )
        prompt_cases.append({"output": output, "prompt_sha256": seen[cid0][0]["prompt_sha256"]})

    golden = {
        "source": "packages/bench/scripts/upstream-judge-golden.py",
        "upstream_commit": "a983828b3bb7565e16e25ac8cdc2fc1982633b0b",
        "judge_prompt_sha256": _sha(Path(prompt_path).read_text(encoding="utf-8")),
        "first_prompt": first_prompt,
        "parse_cases": parse_cases,
        "redact_cases": redact_cases,
        "prompt_cases": prompt_cases,
        "runs": runs,
    }
    with open(args.out, "w", encoding="utf-8", newline="\n") as f:
        f.write(json.dumps(golden, indent=2, ensure_ascii=False) + "\n")
    print(f"wrote {len(parse_cases)} parse cases, {len(redact_cases)} redact cases, 2 runs to {args.out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
