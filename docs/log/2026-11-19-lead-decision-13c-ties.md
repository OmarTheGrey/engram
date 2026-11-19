---
date: 2026-11-19
author: omar
type: decision
card: R1
chapter: design
pillar: research
hypothesis: none
evidence:
  - docs/research/prereg-v1-decisions.md
  - research/analysis/bootstrap.py
supersedes: docs/log/2026-11-03-pr4b-decision-ties.md
---

**What.** The lead accepted the recommendation of decision sheet item 13c: every comparison of a resample mean with a bound treats values within 1e-9 as equal, and BCa's z0 counts resamples tying the observed mean as half below, as scipy does.

**Why.** He took the sheet's recommendations on 2026-11-19 for every item except 1, 16 and 20, and this item's evidence and alternatives are on the sheet.

**Result.** The item's answer line reads "accept (2026-11-19)", and v1 states the value without the "(recommended; ...)" mark (`docs/research/preregistration.md`).

**Consequence.** `TOLERANCE` and `bca_interval` are unchanged.
