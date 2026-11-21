---
date: 2026-11-21
author: claude-agent
type: decision
card: none
chapter: design
pillar: research
hypothesis: H1
evidence:
  - research/tests/test_run_limits.py
  - research/results/h2-cost-table.json
  - packages/runner/src/journal.ts
  - research/configs/h1-gatemem.json
supersedes: docs/log/2026-11-21-answers-decision-ceilings-from-the-decided-block.md
---

**What.** Each `spend_ceiling_usd` is in ledger dollars: 1.25 times the run's high estimate priced at pi-ai 1.3.0's catalogue cost, from the cost table's token counts (the coordinator's decision under the lead's delegation, review finding ANS-1).

**Why.** The runner's ledger prices each call with pi-ai's `calculateCost` over `model.cost` (`spentByProvider` in `journal.ts`): 0.66 and 1.98 per million for M1, half the list price the cost table uses, so a list-dollar ceiling tripped at about twice the intended spend.

**Result.** 945.29 (H1 GateMem), 2.32 (H1 MEM-INV-Bench), 102.29 and 103.45 (H2's baselines), from high estimates of 756.23, 1.86, 81.83 and 82.76 ledger dollars. The test records each model's and judge's catalogue price and ratio to the list price (M1 2.0, M2 0.266 and 0.1568, M3 1.0294 and 1.0048, judges 1.0) and fails if pi-ai's price changes.

**Consequence.** A runner card metering OpenRouter's own cost would let the ceiling bound real spend directly (backlog).
