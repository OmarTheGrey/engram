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
  - docs/log/2026-11-02-pr2-decision-wilson-on-items.md
  - research/analysis/wilson.py
supersedes: none
---

**What.** Recommended, for the lead's decision: the table's rate is the mean over items of seed-averaged outcomes, and its Wilson interval takes the item count as n with fractional successes (decision sheet item 13e).

**Why.** The item is the unit of analysis; three seeds of one item are not three independent trials.

**Result.** Counting seeds as trials would narrow the interval about threefold in trials (`docs/log/2026-11-02-pr2-decision-wilson-on-items.md`).

**Consequence.** If changed, the call to `wilson` in `build_h1_table`.
