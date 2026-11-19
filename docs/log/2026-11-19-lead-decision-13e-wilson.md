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
  - research/analysis/wilson.py
supersedes: docs/log/2026-11-03-pr4b-decision-wilson.md
---

**What.** The lead accepted the recommendation of decision sheet item 13e: the table's rate is the mean over items of each item's seed-averaged outcome, and its Wilson interval takes the item count as n and the rate times n as successes.

**Why.** He took the sheet's recommendations on 2026-11-19 for every item except 1, 16 and 20, and this item's evidence and alternatives are on the sheet.

**Result.** The item's answer line reads "accept (2026-11-19)", and v1 states the value without the "(recommended; ...)" mark (`docs/research/preregistration.md`).

**Consequence.** `research/analysis/wilson.py` is unchanged.
