---
date: 2026-11-21
author: claude-agent
type: decision
card: R2
chapter: design
pillar: research
hypothesis: none
evidence:
  - docs/research/preregistration.md
  - research/results/h2-cost-table.json
  - research/configs/cost-table.json
supersedes: docs/log/2026-11-21-r2-decision-costs-from-ceilings.md
---

**What.** Each dollar bound is now scaled by session count from a registered run's high estimate at OpenRouter's list prices, not from its spend ceiling.

**Why.** After the rebase, the answers branch states the ceilings in ledger dollars at pi-ai's catalogue prices. Scaling a ceiling no longer gives real dollars, and my earlier figures (4.65, 203.44, 205.76, and 1,560.26 behind 128) were no longer in the file.

**Result.** P2 is 1.86 dollars (228 of 456 sessions at 3.72). U1's arm M is 0.93, and its arm T is 102.42 (2,184 of 26,616 sessions at 1,248.21). The LongMemEval parts are 164.61 each, and U2 is 327.36. An arm's ceiling is the cost table's to compute.

**Consequence.** The bounds move with the cost table's next revision.
