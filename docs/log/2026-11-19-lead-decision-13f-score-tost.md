---
date: 2026-11-19
author: omar
type: decision
card: R1
chapter: design
pillar: research
hypothesis: H4
evidence:
  - docs/research/prereg-v1-decisions.md
  - research/analysis/equivalence.py
supersedes: docs/log/2026-11-03-pr4b-decision-score-tost.md
---

**What.** The lead accepted the recommendation of decision sheet item 13f: each pair of H4's arms is decided by two one-sided score tests, each side at alpha / 2, with p = min(1, 2 max(p_lower, p_upper)); not a bootstrap.

**Why.** He took the sheet's recommendations on 2026-11-19 for every item except 1, 16 and 20, and this item's evidence and alternatives are on the sheet.

**Result.** The item's answer line reads "accept (2026-11-19)", and v1 states the value without the "(recommended; ...)" mark (`docs/research/preregistration.md`).

**Consequence.** `research/analysis/equivalence.py` and the two H4 results stand.
