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
  - research/analysis/equivalence.py
  - research/results/h4-holm-levels.json
supersedes: none
---

**What.** Recommended, for the lead's decision: in H4 an item that loses a seed under either arm of a pair leaves that pair's test, and the count is reported (decision sheet item 13h).

**Why.** H4's level was searched over the three-seed lattice of item differences; an item averaged over two seeds lies off it.

**Result.** The level search covers items with three seeds, independent and identically distributed, on the boundary of the composite null (`research/analysis/equivalence.py`, `research/results/h4-holm-levels.json`). No H4 table code exists yet; the rule is for it.

**Consequence.** The alternative, averaging over the remaining seeds as H1 does, keeps the items and loses the coverage.
