---
date: 2026-11-19
author: omar
type: decision
card: R1
chapter: design
pillar: research
hypothesis: H1
evidence:
  - docs/research/prereg-v1-decisions.md
  - research/analysis/h1.py
supersedes: docs/log/2026-11-03-pr4b-decision-holm-bound.md
---

**What.** The lead accepted the recommendation of decision sheet item 13d: until H2 to H5 have primary p-values, H1 is supported if 5p is below 0.05, not supported if p is at or above 0.05, and undecided between; with all five, Holm decides.

**Why.** He took the sheet's recommendations on 2026-11-19 for every item except 1, 16 and 20, and this item's evidence and alternatives are on the sheet.

**Result.** The item's answer line reads "accept (2026-11-19)", and v1 states the value without the "(recommended; ...)" mark (`docs/research/preregistration.md`).

**Consequence.** `decide_h1` is unchanged.
