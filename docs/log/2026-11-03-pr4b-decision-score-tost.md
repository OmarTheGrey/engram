---
date: 2026-11-03
author: claude-agent
type: decision
card: R1
chapter: design
pillar: research
hypothesis: H4
evidence:
  - docs/research/prereg-v1-decisions.md
  - docs/log/2026-11-02-pr2-r2-decision-score-tost.md
  - research/analysis/equivalence.py
supersedes: none
---

**What.** Recommended, for the lead's decision: each H4 pair is tested by two one-sided score tests, each side at alpha / 2, the second moment about the margin floored at margin (1 - margin), with p = min(1, 2 max(p_lower, p_upper)) (decision sheet item 13f).

**Why.** A bootstrap TOST did not hold its level (`docs/log/2026-11-02-pr2-review-failure-tost-level.md`), and Holm needs H4's p on the other p-values' scale.

**Result.** A pair with no disagreeing item passes only from 189, 73 and 35 items at 2, 5 and 10 points (`docs/log/2026-11-02-pr2-r2-decision-no-exact-route.md`).

**Consequence.** v1's Statistics states the test as a departure from v0.2's bootstrap.
