---
date: 2026-11-02
author: claude-agent
type: decision
card: X1
chapter: evaluation
pillar: research
hypothesis: H1
evidence:
  - fixtures/bench/mem-inv-bench/full/cases.jsonl
  - fixtures/bench/mem-inv-bench/README.md
  - packages/bench/scripts/vendor-mem-inv-bench.py
  - packages/bench/test/mem-inv-bench/prompt.test.ts
supersedes: none
---

**What.** H1's MEM-INV-Bench set is the full laundering-channel study at `cf3c9a4`: each of the 8 attack scenarios in each of the 4 channels and each of the 6 benign scenarios, 38 cases, vendored into `full/cases.jsonl` beside the 24-case fixture.

**Why.** Upstream's experiment 1 runs exactly these cells (`exp1_propensity.py`); the Parquet tables hold other studies. Every cell has a usable recorded proposal of the reference model, so each self-summarisation note is the recorded one, the same for every condition and model.

**Result.** The 24 fixture cases keep their ids and come first; the other 14 are `mib-25` to `mib-38` in a seeded order. All 38 rebuilt requests match the recorded study's sha256.

**Consequence.** A live model's own summaries are not used: the note is part of the world the conditions share.
