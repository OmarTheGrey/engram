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
supersedes: docs/log/2026-11-03-pr4b-decision-h4-lost-seeds.md
---

**What.** The lead accepted the recommendation of decision sheet item 13h: in H4 an item that loses a seed under either arm of a pair leaves that pair's test, and the count is reported, since H4's level was searched on the three-seed lattice.

**Why.** He took the sheet's recommendations on 2026-11-19 for every item except 1, 16 and 20, and this item's evidence and alternatives are on the sheet.

**Result.** The item's answer line reads "accept (2026-11-19)", and v1 states the value without the "(recommended; ...)" mark (`docs/research/preregistration.md`).

**Consequence.** H4's table pairs through `complete_item_differences` when it is written.
