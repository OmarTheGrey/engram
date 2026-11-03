---
date: 2026-11-03
author: claude-agent
type: change
card: R1
chapter: implementation
pillar: research
hypothesis: H1
evidence:
  - research/analysis/h1.py
  - research/tests/test_h1_secondary.py
supersedes: none
---

**What.** `build_h1_table` raises when `sensitivity_items` is given without `gatemem_primary`.

**Why.** P4V-5.

**Result.** A test asks for a sensitivity table without a primary set and gets the error. The mutant removing the guard is killed.

**Consequence.** A config naming a sensitivity list must name the primary set.
