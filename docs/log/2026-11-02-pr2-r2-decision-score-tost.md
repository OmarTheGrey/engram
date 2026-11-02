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
  - research/tests/test_equivalence.py
supersedes: docs/log/2026-11-02-pr2-review-decision-tost-method.md
---

**What.** H4's TOST is two one-sided score tests: z from the mean and the second moment of the differences about the margin, that moment floored at margin (1 - margin), each side at alpha / 2.

**Why.** The review asked for one test across the whole range or a route fixed by the design. The floor is the null variance of the sparsest disagreement the margin allows when seeds repeat their outcome, so a sample with few or no disagreeing items cannot pass on a vanishing variance. The decision uses only (sum d, sum d^2) and is monotone in dispersion.

**Result.** No bootstrap, so no seed. Rejected: a betting interval, valid at any n but untested here. Cost if wrong: the normal approximation runs high with rare one-sided counts; the power table measures that.

**Consequence.** PR 4 states this test in v1, a departure from the bootstrap.
