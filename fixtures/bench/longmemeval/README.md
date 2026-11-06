# LongMemEval fixture subset (card B5)

Twenty questions of LongMemEval, two from each of its ten categories (six question types, four of which also have abstention questions), vendored from the release recorded in `packages/bench/PINS.md` for the layer-7 benchmark fixture (`docs/conventions/testing.md`) and the pipeline config `research/configs/b5-longmemeval-plane.json`. The tests in `packages/bench/test/longmemeval/` and `packages/runner/test/longmemeval-probe.test.ts`, `make bench BENCH=longmemeval` and `make run CONFIG=research/configs/b5-longmemeval-plane.json` run on these files and never reach the network.

## Source

- Repository: https://github.com/xiaowu0162/LongMemEval, commit `9e0b455f4ef0e2ab8f2e582289761153549043fc`. Dataset: Hugging Face `xiaowu0162/longmemeval-cleaned`, revision `98d7416c24c778c2fee6e6f3006e7a073259d48f`, file `longmemeval_oracle.json` (the oracle history: only the evidence sessions; 500 questions). Results on the cleaned files are not comparable with the original 2024 files (PINS.md).
- `questions.jsonl` holds the selected upstream records, one per line, re-serialised with their keys in upstream's order and nothing changed.
- `upstream/` holds three upstream sources byte for byte (`src/evaluation/evaluate_qa.py`, `src/evaluation/print_qa_metrics.py`, `src/generation/run_generation.py`), so `prompt.test.ts` can hold the port's prompt strings to them. They are read as text and never run.
- `manifest.json` holds the sha256 of every upstream file read (`upstream_sha256`), the selected questions with their category and size, and the sha256 of every line of `questions.jsonl`, `script.json`, `judge-script.json` and the vendored sources (`files`), which `engram doctor` checks against the pinned commit.

## Licences and attribution

- Code and data: MIT, Copyright (c) 2024 Di Wu. The licence text is in `UPSTREAM-LICENSE`, copied byte for byte from the upstream `LICENSE`. The port in `packages/bench/src/longmemeval/` (schema, prompts, judge, breakdown) derives from it and names the notice in its headers.
- Attribution: Di Wu, Hongwei Wang, Wenhao Yu, Yuwei Zhang, Kai-Wei Chang, Dong Yu. "LongMemEval: Benchmarking Chat Assistants on Long-Term Interactive Memory", arXiv 2410.10813, ICLR 2025.

## Selection rule

`packages/bench/scripts/vendor-longmemeval.ts`, seed 20261107, deterministic (rerunning it on the pinned files gives the same bytes):

1. Group the 500 questions by category: the question type, with `+abstention` when the id contains `_abs` (upstream's rule).
2. In each category, keep the questions whose record is at most 12,000 bytes of JSON, sort them by id and shuffle them with the seeded PRNG; take the first two. A category with fewer than two such questions takes its smallest other records, by size then id. Seven of the ten categories fall back this way, wholly or in part, since their records are larger; the subset's records run from about 5 to 29 KB.
3. List them in category order.

## The scripted replies

These check the pipeline; they are never results.

- `script.json`, the reader: one `memory_read` with the question as its query, then a reply. The first pick of each non-abstention category replies with upstream's answer, the second with "I don't know."; an abstention question replies that the chat history does not say.
- `judge-script.json`, the judge: "yes" when the scripted reply is upstream's answer or the question is an abstention one, else "no".

## Files

| file | what |
|---|---|
| `questions.jsonl` | the twenty upstream question records |
| `script.json` | the scripted reader's steps, by question id |
| `judge-script.json` | the scripted judge's replies, by question id |
| `manifest.json` | source, seed, upstream hashes, the selection, line hashes |
| `upstream/` | three upstream sources, byte for byte, for the prompt test |
| `UPSTREAM-LICENSE` | upstream's MIT licence |

Rerun with `make fixtures MSG="..."`, which fetches the pinned files into `.engram/upstream/longmemeval` when they are missing (data and source text only).
