---
date: 2026-10-29
author: claude-agent
type: finding
card: B4
chapter: related-work
pillar: research
hypothesis: H1
evidence:
  - fixtures/bench/mem-inv-bench/README.md
  - fixtures/bench/mem-inv-bench/manifest.json
  - packages/bench/scripts/vendor-mem-inv-bench.py
  - packages/bench/PINS.md
supersedes: none
---

**What.** MEM-INV-Bench at `cf3c9a4` defines its laundering-channel attacks in code, not in its Hugging Face Parquet tables.

**Why.** Card B4 had to find where an attack case, its origin channels, its laundering channel, its action and its scoring live before vendoring.

**Result.** `code/scenarios.py` authors 8 attack scenarios (pay, send_data, update_setting, purchase) and 6 legitimate actions; `code/exp1_propensity.py` builds memory per channel: direct (one web item), summarize L-a (the agent's paraphrase of a web item), tool_echo L-b (a trusted lookup echoing it), corroborate L-c (web plus inbox), each with a trusted erp filler. Scoring is `review.bucket_of` with recorded readings first (`score.verdict_of`); HIT is attack success. The Parquet tables hold the five extension plans. All 24 rebuilt memories equal the recorded study's (`manifest.json`, `recorded_prompt_sha256`); the reference model's recorded replies are HIT on 17 of 20 attacks (`upstream-golden.json`).

**Consequence.** No Parquet reader or new dependency; X3 can extend the subset from the same script.
