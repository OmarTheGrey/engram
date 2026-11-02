# GateMem fixture subset (card B1)

Twenty GateMem checkpoints and the four episodes they belong to, vendored from the pinned upstream commit for the layer-7 benchmark fixture (`docs/conventions/testing.md`). The tests in `packages/bench/test/gatemem/` and `make bench BENCH=gatemem` run on these files and never reach the network.

## Source

- Repository: https://github.com/rzhub/GateMem, commit `a983828b3bb7565e16e25ac8cdc2fc1982633b0b` (the pin in `packages/bench/PINS.md`).
- Files read: `bench/data/<domain>/episodes.jsonl` and `bench/data/<domain>/checkpoints.jsonl` for the four domains, fetched at that commit from `raw.githubusercontent.com` on 2026-10-25. All 39 files fetched matched the git blob ids in the commit's tree (`gh api repos/rzhub/GateMem/git/trees/<commit>?recursive=1`).
- `manifest.json` holds the sha256 of every upstream file the vendoring or the port read (`upstream_sha256`), and the sha256 of every vendored line (`selection`). Each vendored line is byte-identical to an upstream line; `load.test.ts` checks the hashes.

## Licences and attribution

- Code: MIT, Copyright (c) 2026 Renz. The licence text is in `UPSTREAM-LICENSE`, copied from the upstream `LICENSE`. The port in `packages/bench/src/gatemem/` (agents, prompt, parsing, scoring) and the verbatim files in `packages/bench/src/gatemem/vendor/` derive from it.
- Data: Creative Commons Attribution 4.0 International (CC BY 4.0, https://creativecommons.org/licenses/by/4.0/), as stated by the upstream `CITATION.cff` (`license: CC-BY-4.0`) and recorded for the Hugging Face dataset card (`Ray368/GateMem`) in `packages/bench/PINS.md`. The episodes and checkpoints here are an unmodified subset: whole lines selected, none changed.
- Every ported source file in `packages/bench/src/gatemem/` names the MIT notice and this folder's `UPSTREAM-LICENSE` in its header (`licence.test.ts` checks it).
- `upstream-edge-golden.json`: what upstream's own `generate_llm_output`, `flatten_output_text` and `pattern_hits` return on crafted inputs (floats, exponents, str() of dicts, key order, non-ASCII text against `\w`, `\s`, `\d`, `\b` and `$`, replies written as Python literals that reach upstream's `ast.literal_eval` fallback, and case-insensitive matching of non-ASCII text), written by `packages/bench/scripts/upstream-edge-golden.py` from the upstream files at the pinned commit (their sha256 are in `manifest.json` under `upstream_sha256`); `edge.test.ts` holds the port to it. The rows under `parse_untranslatable` and `patterns_untranslatable` record what upstream returns where the port throws instead (a set, bytes or a complex number in a reply, a back reference under IGNORECASE). Its inputs are written for the test, not taken from the dataset.
- Attribution: Zhe Ren, Yibo Yang, Yimeng Chen, Zijun Zhao, Benshuo Fu, Zhihao Shu, Bingjie Zhang, Yangyang Xu, Dandan Guo, Shuicheng Yan. "GateMem: Benchmarking Memory Governance in Multi-Principal Shared-Memory Agents", arXiv 2606.18829, 2026. The data is synthetic and holds no real person's records (upstream `DATASET_CARD.md`).

## Selection rule

`packages/bench/scripts/vendor-gatemem.ts`, seed 20261025, deterministic (rerunning it on the same upstream files gives the same bytes):

1. Per domain, in alphabetical order (education, household, medical, office), sort the episode ids and draw one with a seeded PRNG (mulberry32).
2. Group that episode's checkpoints by `query_type`, sort each group by `checkpoint_id` and shuffle it with the same PRNG.
3. Take 2 utility, 2 privacy and 2 safety checkpoints, minus one from the type at position (domain index mod 3), so 5 per domain. The privacy picks prefer one expected `refuse` and one expected `answer_redacted` when the episode has both.

Result: 6 utility, 7 privacy (access control), 7 safety (active forgetting); expected actions answer 6, answer_redacted 4, refuse 3, no_memory 7. Rerun with:

```
node packages/bench/scripts/vendor-gatemem.ts --upstream <dir with the upstream files at the commit> --out fixtures/bench/gatemem
```

## Other files

- `script.json`: the scripted answer model's raw text per checkpoint, written by the same script. Rule: the expected action with a neutral sentence, except four planted cases named under `planted` (a leak that quotes a literal leak pattern, a refusal, a fenced JSON answer, a plain-text answer that is not JSON). The script uses the hidden labels; the agent never sees them.
- `run-config.json`: the run config for `make bench BENCH=gatemem` (model `scripted/scripted-1`, seed 1, temperature 0.2 and max tokens 4096 as in upstream `configs/runs/paper_main.yaml`, max turns 300 as `run_eval.py` sets for Long-Context), and its `judge`: `scripted/judge-1`, seed 1, temperature 0 and max tokens 4096 as the paper's GPT-4o judge (`PAPER_JUDGE` in `judge.ts`).
- `cassettes/`: the cached responses of the scripted model, one file per call in the `fileCache` format of `@engram/runner`, keyed on (item, condition, preset, store, model, seed, prompt hash). With them a run makes zero model calls, and with `ENGRAM_OFFLINE=1` a missing one is an error. Regenerated only by `make fixtures` (`run-gatemem.ts --record`, which empties the folder and records the scripted model into it).
- `judge-script.json`: the scripted judge's raw reply per checkpoint (one reply, or one per attempt), written by hand for PR 6; its `rule` field says what each planted reply exercises. The verdicts follow the hidden labels and the scripted answers; they are not GPT-4o's and not comparable with the paper.
- `judge-cassettes/`: the scripted judge's 24 cached calls (20 checkpoints; one needs two attempts, one three, one two), regenerated only by `make fixtures` (`run-gatemem.ts --record`, which empties the folder and records the scripted judge into it; never copied in by hand). Keyed like `cassettes/`; the judge's model and prompt make its keys distinct. `make bench BENCH=gatemem` reports judge scores when this folder exists.
- `upstream-judge-golden.json`: what upstream's `bench/eval/judge.py` (`_parse_judge_from_text`, `_coerce_judge_tri_bool`, `_redact_notes`, `run_llm_judge`) and `score_predictions.py` (`_promote_judge_metrics`) return at the pinned commit on crafted replies, on crafted agent outputs (the prompt's sha256) and on this subset with `judge-script.json`, with and without `gate_by_action`; written by `packages/bench/scripts/upstream-judge-golden.py`; `judge.test.ts` holds the port to it. The judge prompt is vendored verbatim as `packages/bench/src/gatemem/vendor/judge_prompt.txt`, listed with its sha256 and MIT notice under `vendored` in `manifest.json`.
- `upstream-golden.json`: prompt hashes, parsed outputs and rule-based scores produced by GateMem's own Python code (`LongContextAgent`, `run_episode`, `score_one`, `aggregate`) on this subset with the same scripted responses; written by `packages/bench/scripts/upstream-golden.py`. `upstream.test.ts` holds the port to it.
- `upstream-rag-policy-golden.json`: what GateMem's RAG-Policy baseline (`PolicyRAGAgent` in `bench/agents/rag_policy.py`, turn chunks, retrievers stubbed) attaches to each chunk and which chunks its relationship-aware gate allows, per checkpoint of this subset (the allowed turn ids, and the sha256 of the chunk metadata as canonical JSON), and whether rerunning the gate with every hidden checkpoint field changed moved anything (it did not, on any checkpoint); written by `packages/bench/scripts/upstream-rag-policy-golden.py`, which also hashes the three upstream files it ran. `rag-policy.test.ts` holds the port (`packages/bench/src/gatemem/rag-policy.ts`, condition C4 of ADR 0031) to it. On the pinned full set the same script and `packages/bench/scripts/check-rag-policy-upstream.ts` compare all 2,218 checkpoints.
- `upstream-rag-policy-full.json`: the same script's `--hashes` output on the pinned full set: per checkpoint, the first 16 hex digits of the sha256 of upstream's row as canonical JSON, and the count of checkpoints on which changing every hidden field moved nothing (2,218). `rag-policy-full.test.ts` recomputes every hash from the port when `.engram/upstream/gatemem/bench/data` holds the pinned full set, and skips, saying why, when it does not.
- `x1-probe-script.json` and `x1-judge-script.json`: the scripted answers and judge verdicts of card X1's fixture probe (`research/configs/x1-h1-gatemem.json`, `x1-h1-gatemem-rag.json`); a step keyed `<checkpoint>@C1` serves C1, which has no memory tool. Written for the pipeline, not taken from the dataset.

## Upstream layout and fields found at the commit

The dataset is `bench/data/{education,household,medical,office}/{episodes,checkpoints}.jsonl`: 91 episodes (30, 23, 21, 17) and 2,218 checkpoints (540, 552, 579, 547), 186 to 260 turns per episode, 18 to 35 checkpoints per episode.

Episode line: `episode_id`, `domain`, `entities` (`principals`: `principal_id`, `role`, `display_name`; `relationships`: objects with `type` and string-valued fields such as `clinician_id`, `patient_id`, `scope`, `access_level`; absent on 6 episodes), `turns`. Turn: `turn_id`, `speaker` (`principal_id`, `role`), `text`, and on most turns `timestamp` and `turn_kind` (dialogue, note_update, portal_message, handoff_summary, scheduling_note, callback_log, lab_result, medication_update). No turn has `record_refs` or `memory_ops`, although the upstream `Turn` dataclass declares them.

Checkpoint line: shown to the agent are `checkpoint_id`, `episode_id`, `as_of_turn_id`, `asker` (`principal_id`, `role`) and `query_text`. Hidden, for scoring only: `query_type` (utility, privacy, safety; the paper's Utility, Access Control, Active Forgetting), `expected_action` (answer, answer_redacted, refuse, no_memory), `judge_spec` (`expected_action`, `notes`, and when present `include`, `not_include`, and on 23 office checkpoints `attack_type`), `leak_targets` (absent on 188 checkpoints) and `attack_type` (on 1,490). The upstream `Checkpoint` dataclass also declares the legacy hidden fields `gold_answer_structured`, `gold_refusal_category` and `policy_snapshot`; none occurs in the data. The strict loader in `packages/bench/src/gatemem/schema.ts` parses all 2,218 checkpoints.
