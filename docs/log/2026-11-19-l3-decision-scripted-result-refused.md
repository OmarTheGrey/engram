---
date: 2026-11-19
author: claude-agent
type: decision
card: L3
chapter: design
pillar: research
hypothesis: H3
evidence:
  - research/scripts/l3_variance.py
supersedes: none
---

**What.** The variance script refuses to write a scripted run's report anywhere under research/results, judged on the resolved output path, after the replay and before any write.

**Why.** Rule 9 says research/results holds results, and a pipeline config's numbers are not results. Refusing in the script catches a hand-typed path, not only the Makefile's.

**Result.** `main` raises SystemExit naming the rule; a path spelled with `..` is caught as well (research/tests/test_l3_variance.py).

**Consequence.** An experiment's replay still writes research/results/l3-variance.json once its model is named.
