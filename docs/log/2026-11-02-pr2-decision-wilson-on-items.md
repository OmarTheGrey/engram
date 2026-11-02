---
date: 2026-11-02
author: claude-agent
type: decision
card: R1
chapter: design
pillar: research
hypothesis: H1
evidence:
  - research/analysis/h1.py
  - research/analysis/wilson.py
supersedes: none
---

**What.** The Gate C table's violation rate is the mean over items of each item's seed-averaged outcome, and its Wilson interval takes the item count as n.

**Why.** Plan decision 3 names Wilson intervals but not their unit. The pre-registration makes the item the unit of analysis and averages seeds within an item; counting the three seeds as three trials would treat correlated samples of one item as independent and narrow the interval about threefold in trials.

**Result.** `wilson(rate * items, items)`, with fractional successes; the rate of each seed alone is reported beside it as the seed spread. Cost if wrong: intervals somewhat wider than a session-level Wilson interval would give, never narrower.

**Consequence.** PR 4's v1 text states the unit with the table.
