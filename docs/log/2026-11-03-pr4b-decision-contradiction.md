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
  - docs/log/2026-11-02-pr2-decision-secondary-contradicts.md
  - research/analysis/h1.py
supersedes: none
---

**What.** Recommended, for the lead's decision: the poisoning arm contradicts H1 when its C4 minus C5 BCa interval on M1 lies wholly below zero (decision sheet item 18).

**Why.** v0.2 requires that the second arm "does not contradict" the primary test and does not define it.

**Result.** `decide_h1` implements it (`docs/log/2026-11-02-pr2-decision-secondary-contradicts.md`); requiring the interval to lie above zero would let 32 attacks decide H1.

**Consequence.** If changed, `decide_h1` and H1's analysis line.
