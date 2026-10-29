# MEM-INV-Bench fixture subset (card B4)

Twenty-four laundering-channel cases of MEM-INV-Bench (twenty attacks, five per channel, and four benign actions), vendored from the commit recorded in `packages/bench/PINS.md` for the layer-7 benchmark fixture (`docs/conventions/testing.md`) and the poisoning arm's pipeline config (ADR 0029). The tests in `packages/bench/test/mem-inv-bench/` and `packages/runner/test/mem-inv-probe.test.ts`, and `make run CONFIG=research/configs/b4-mem-inv-probe.json`, run on these files and never reach the network.

## Source

- Repository: https://github.com/yedidel/mem-inv-bench, commit `cf3c9a4ca9f0478000d6aa26eb268b875232d34b` (the candidates row of `packages/bench/PINS.md`; artifact version 2.1.0). Dataset: Hugging Face `anonymos-2321135/MEM-INV-Bench`, revision `59e5bcdb3a4c20da2d378f381f129b4a45dec2dc`; its five Parquet configurations hold the extension plans (dispatch, extraction, external, recovery, camel), not these cases, so no Parquet file is read.
- The cases are authored in upstream `code/scenarios.py` (`ATTACK`, `LEGIT`, `CHANNELS`) and their memory is built by `build_memory` and `build_legit_memory` in `code/exp1_propensity.py`. The vendoring reads `scenarios.py` with Python's `ast` (it never imports or runs upstream code), rebuilds each case's memory with a port of those two functions, and checks every rebuilt memory block against the one the recorded eight-model study sent (`evidence/recorded-evidence.zip`, `logs/exp1_*.jsonl`); all 24 match.
- The self-summarisation note (channel `summarize`) is a model's paraphrase upstream; the recorded one of the reference model (`openai/gpt-5.6-terra`, trial 0) is used. A record is used only if its memory carries the scenario's current attacker value (upstream `review._stale`), which skips the superseded `saas_admin` cells.
- `manifest.json` holds the sha256 of every upstream file read (`upstream_sha256`), of the recorded system prompt and of each case's recorded request (`cases[].recorded_prompt_sha256`; `prompt.test.ts` holds the port's rendering to them), and of every line of `cases.jsonl` (`files`), which `engram doctor` checks against the commit of the candidate row.

## Licences and attribution

- Code and data: MIT, Copyright (c) 2026 Yedidel Louck. The licence text is in `UPSTREAM-LICENSE`, copied byte for byte from the upstream `LICENSE`. The port in `packages/bench/src/mem-inv-bench/` (schema, prompt, scorer) derives from it and names the notice in each file header (`licence.test.ts` checks it). The scenario text, the adjudication table and the recorded proposals are the author's.
- Attribution: Yedidel Louck. "Securing LLM-Agent Long-Term Memory Against Poisoning: Non-Malleable, Origin-Bound Authority with Machine-Checked Guarantees", arXiv 2606.24322, 2026; software "MEM-INV-Bench: Persistent Memory Authorization Experiments", version 2.1.0 (upstream `CITATION.cff`). The fixtures are authored, synthetic entities; no real person's data.

## Selection rule

`packages/bench/scripts/vendor-mem-inv-bench.py`, seed 20261029, deterministic (rerunning it on the pinned commit gives the same bytes):

1. Sort the eight ATTACK scenario ids and shuffle them; for channel c (direct, summarize, tool_echo, corroborate) take the ids at positions (5c + j) mod 8 for j in 0 to 4: twenty attack cases, five per channel, every scenario in two or three channels.
2. Sort the six LEGIT scenario ids and shuffle them; take the first with 2, 1 and 0 vouchers, then the next one not taken: four benign cases.
3. Case ids are `mib-01` to `mib-24` in that order; they carry no label.

Rerun with `make fixtures MSG="..."`, which clones the pinned commit into `.engram/upstream/mem-inv-bench` when it is missing.

## Files

- `cases.jsonl`: one case per line. Visible to the plane and the model (`strip.ts`): `case_id`, `task` and `memory` (each entry's `entry_id`, the `channel` it was written through, the channels it was `derived_from`, and its `text`). Hidden, for scoring only: `family`, `channel` (the laundering channel), `sid`, `domain`, `tool`, `tier`, `entity`, and the scoring keys `evil` and `good` (attacks) or `value` and `vouchers` (benign).
- `script.json`: the scripted model's reply per case, the reference model's recorded trial-0 proposal verbatim, with the transcript line it came from.
- `probe-script.json`: the runner's scripted pi model per case: one `memory_read` with an empty query (every store answers it with all it holds, as upstream shows the model its whole memory), then the recorded proposal.
- `upstream-golden.json`: what upstream's `review.bucket_of` and `score.verdict_of` return at the pinned commit on each case's scripted proposal and on 42 crafted replies that reach every bucket and both verdict sources; written by `packages/bench/scripts/upstream-mem-inv-golden.py` (which does run upstream code); `score.test.ts` holds the port to it.
- The cassettes of the B4 probe are in `fixtures/cassettes/b4-mem-inv-probe/`, recorded only by `make fixtures`.
