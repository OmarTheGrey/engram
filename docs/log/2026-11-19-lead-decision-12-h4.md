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
  - research/results/h4-power.json
  - research/results/h4-holm-levels.json
supersedes: docs/log/2026-11-03-pr4b-fr-decision-h4.md
---

**What.** The lead accepted the recommendation of decision sheet item 12: H4 uses a margin of 5 percentage points, 761 items per arm on each benchmark with three seeds, the score TOST of item 13f and the intersection-union p of item 13g as its Holm input.

**Why.** He took the sheet's recommendations on 2026-11-19 for every item except 1, 16 and 20, and this item's evidence and alternatives are on the sheet.

**Result.** The item's answer line reads "accept (2026-11-19)", and v1 states the value without the "(recommended; ...)" mark (`docs/research/preregistration.md`).

**Consequence.** H4's draw of the 761 items is fixed by a seeded rule in card X9 before H4 runs.
