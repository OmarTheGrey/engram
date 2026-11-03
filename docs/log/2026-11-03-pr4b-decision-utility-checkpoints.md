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

**Result.** Utility is 8,736 of the 26,616 sessions (`docs/log/2026-11-02-x1r-utility-checkpoints.md`); the cost with and without them is in `research/results/h1-cost.json` [pending part A's fix].

**Consequence.** If dropped, `items` in `research/configs/h1-gatemem.json` changes and MGS is not reported.
