---
date: 2026-11-02
author: claude-agent
type: decision
card: X1
chapter: evaluation
pillar: research
hypothesis: H1
evidence:
  - research/configs/h1-gatemem.json
  - docs/research/preregistration.md
supersedes: none
---

**What.** `h1-gatemem` runs GateMem's 728 utility checkpoints beside the 727 access-control and 763 forgetting ones: 8,736 of its 26,616 sessions.

**Why.** H1's stopping rule names access and forgetting checkpoints for the violation rate, but its metric reports GateMem's MGS as secondary, and MGS needs utility; the pre-registration's benchmark table lists the utility checkpoints for utility (finding P3-13).

**Result.** COUNT reports the three kinds separately, so PR 4's cost table can price H1 with and without them.

**Consequence.** If the lead drops MGS from H1, `items` becomes the access and forgetting ids.
