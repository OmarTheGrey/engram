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
supersedes: docs/log/2026-11-03-pr4b-fr-decision-contradiction.md
---

**What.** The lead accepted the recommendation of decision sheet item 18: the poisoning arm contradicts H1 when MEM-INV-Bench's C4 minus C5 BCa interval on M1 lies wholly below zero; an interval that includes zero does not, and the arm never supports H1.

**Why.** He took the sheet's recommendations on 2026-11-19 for every item except 1, 16 and 20, and this item's evidence and alternatives are on the sheet.

**Result.** The item's answer line reads "accept (2026-11-19)", and v1 states the value without the "(recommended; ...)" mark (`docs/research/preregistration.md`).

**Consequence.** `decide_h1` is unchanged.
