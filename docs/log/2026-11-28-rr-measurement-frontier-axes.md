---
date: 2026-11-28
author: claude-agent
type: measurement
card: none
chapter: results
pillar: research
hypothesis: H2
evidence:
  - research/results/h2-frontier-axes.json
  - research/configs/frontier-axes.json
  - research/results/MANIFEST.md
  - "uv run python research/scripts/frontier_axes.py --config research/configs/frontier-axes.json --out research/results/h2-frontier-axes.json"
supersedes: docs/log/2026-11-20-rv8-measurement-frontier-axes.md
---

**What.** The offline reach measurement of H2's policy axes against preset medium, on GateMem's 2,218 checkpoints and LongMemEval's 500 questions, with no model called.

**Why.** The superseded entry lacked the config as its own evidence item and said only no-model-source denies a write, which the file contradicts.

**Result.** GateMem: grants off hides 64,987 turn reads on 1,154 checkpoints (`gatemem.by_variant.grants-off`); budget 25 hides 9,740; ttl 1 day 4,544. LongMemEval: medium hides 11,122 turns on 54 questions; ttl 30 days 34,688 on 148. No-model-source denies 5,795 GateMem and 124,334 LongMemEval writes; LongMemEval's budgets also deny writes: 95 at 25, 67 at 50, 61 at 100, 51 at 200, 2 at 400 (`longmemeval.by_variant.budget-*.denied_writes`).

**Consequence.** The budget denials stay as `docs/log/2026-11-20-rv8-finding-budget-denials.md` records them.
