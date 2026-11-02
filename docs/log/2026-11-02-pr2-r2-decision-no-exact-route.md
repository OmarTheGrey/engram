---
date: 2026-11-02
author: claude-agent
type: decision
card: R1
chapter: design
pillar: research
hypothesis: H4
evidence:
  - research/analysis/equivalence.py
supersedes: docs/log/2026-11-02-pr2-review-decision-exact-route-threshold.md
---

**What.** The exact binomial route and its 10-item threshold are withdrawn from H4's TOST.

**Why.** Choosing the route from the observed count of disagreeing items made the decision non-monotone (review finding V1), and the threshold's justification, a scratch probe, was contradicted by the result it was meant to support (V4).

**Result.** The variance floor of the score test does the route's job, a sample with no disagreeing item passing only from z(0.975)^2 (1 - margin) / margin items (189, 73 and 35 at 2, 5 and 10 points), without a switch.

**Consequence.** None.
