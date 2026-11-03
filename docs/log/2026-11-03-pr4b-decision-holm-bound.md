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
  - docs/log/2026-11-02-pr2-decision-holm-bound.md
  - research/analysis/h1.py
supersedes: none
---

**What.** Recommended, for the lead's decision: until H2 to H5 report, H1 is supported if 5p is below 0.05, not supported if p is at or above 0.05, and undecided between (decision sheet item 13d).

**Why.** Gate C reads H1 alone, and Holm's adjusted value for H1 lies between p and 5p whatever the other four are.

**Result.** `decide_h1` implements it, with nine hand cases in `research/tests/test_analysis.py` (`docs/log/2026-11-02-pr2-decision-holm-bound.md`).

**Consequence.** The Gate C read-out can be undecided, and v1 says so.
