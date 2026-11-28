---
date: 2026-11-28
author: claude-agent
type: finding
card: none
chapter: results
pillar: research
hypothesis: none
evidence:
  - research/results/MANIFEST.md
  - docs/log/2026-11-28-rr-measurement-frontier-axes.md
  - docs/log/2026-11-28-rr-measurement-lme-cost.md
  - docs/log/2026-11-28-rr-measurement-check-runs-cost.md
supersedes: none
---

**What.** Every current measurement entry citing one of the 24 MANIFEST rows was checked against the committed JSON, its evidence paths and the row's config.

**Why.** The results register and the thesis drafts must rest on entries whose numbers still hold.

**Result.** 15 rows were in order. Nine current entries needed superseding: seven named the config only inside a command (check-runs-cost, both label-audit draws, the shared draw entry, cost-table, frontier-axes, E9.9's byte check), one cited the unlisted samples file (perf-budget), one named the wrong M1. Facts the files contradict: frontier-axes said only no-model-source denies a write, while `longmemeval.by_variant.budget-25.denied_writes` is 95; LongMemEval's cost entry called gpt-5.6-terra the M1, while the pre-registration's Models section names deepseek-v4-pro-0813. `research/results/h1-check-runs-cost.json` still prices the smoke runs on gpt-5.6-terra.

**Consequence.** Nine `2026-11-28-rr-measurement-*` entries supersede them; repricing the check runs on M1 is left to the H1 run card.
