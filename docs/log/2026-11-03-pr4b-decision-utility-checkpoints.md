---
date: 2026-11-03
author: claude-agent
type: decision
card: R1
chapter: design
pillar: research
hypothesis: H1
evidence:
  - docs/research/prereg-v1-decisions.md
  - research/results/h1-cost.json
  - docs/log/2026-11-02-x1r-utility-checkpoints.md
supersedes: none
---

**What.** Recommended, for the lead's decision: H1's GateMem run keeps the 728 utility checkpoints, which MGS needs (decision sheet item 20).

**Why.** v0.2 reports MGS as H1's secondary, and the choice moves a large share of GateMem's cost.

**Result.** Utility is 8,736 of the 26,616 sessions (`docs/log/2026-11-02-x1r-utility-checkpoints.md`); for M1, access and forgetting alone cost 221.94 to 1,936.49 dollars against 321.59 to 2,813.02 for all three kinds (`research/results/h1-cost.json`).

**Consequence.** If dropped, `items` in `research/configs/h1-gatemem.json` changes and MGS is not reported.
