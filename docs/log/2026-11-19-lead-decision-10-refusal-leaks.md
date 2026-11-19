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
  - research/results/h1-refusal-leaks.json
supersedes: docs/log/2026-11-03-pr4b-fr-decision-refusal-leaks.md
---

**What.** The lead accepted the recommendation of decision sheet item 10: the 41 checkpoints at which GateMem's rule scorer scores a plain refusal as a leak stay in the primary set, and a sensitivity table without them is reported as a robustness check.

**Why.** He took the sheet's recommendations on 2026-11-19 for every item except 1, 16 and 20, and this item's evidence and alternatives are on the sheet.

**Result.** The item's answer line reads "accept (2026-11-19)", and v1 states the value without the "(recommended; ...)" mark (`docs/research/preregistration.md`).

**Consequence.** The `sensitivity` entry of `research/configs/h1-table.json` is unchanged.
