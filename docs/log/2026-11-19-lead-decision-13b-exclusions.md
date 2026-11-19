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
supersedes: docs/log/2026-11-03-pr4b-decision-exclusions.md
---

**What.** The lead accepted the recommendation of decision sheet item 13b: an (item, seed) excluded or missing under either condition is dropped from both, an item with no seed left leaves the contrast, and the dropped pairs and each exclusion reason's count are reported.

**Why.** He took the sheet's recommendations on 2026-11-19 for every item except 1, 16 and 20, and this item's evidence and alternatives are on the sheet.

**Result.** The item's answer line reads "accept (2026-11-19)", and v1 states the value without the "(recommended; ...)" mark (`docs/research/preregistration.md`).

**Consequence.** `paired_item_differences` and `research/analysis/h1.py` are unchanged.
