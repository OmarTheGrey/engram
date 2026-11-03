---
date: 2026-11-03
author: claude-agent
type: decision
card: R1
chapter: design
pillar: research
hypothesis: none
evidence:
  - docs/research/prereg-v1-decisions.md
  - research/analysis/bootstrap.py
supersedes: none
---

**What.** Recommended, for the lead's decision: when BCa is undefined (every resample on one side of the observed mean) the percentile interval is reported, and when every difference is equal the interval is that value and p is 1 if it is at most zero, else 0 (decision sheet item 13a).

**Why.** v0.2 names BCa, which these two cases leave undefined; a table with holes where violation rates sit at zero would be worse.

**Result.** `paired_bootstrap` reports which method it used with every contrast, and the fixture probe's table shows degenerate contrasts (`docs/log/2026-11-03-pr4a-h1-pipeline.md`).

**Consequence.** If changed, `paired_bootstrap` and v1's Interval line.
