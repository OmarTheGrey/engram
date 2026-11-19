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
  - research/results/h1-gatemem-reach.json
  - docs/decisions/0030-gatemem-principals-as-scopes-and-grants.md
supersedes: docs/log/2026-11-03-pr4b-lp-decision-forgetting.md
---

**What.** The lead accepted the recommendation of decision sheet item 9: GateMem's 727 access-control checkpoints are H1's primary set and the 763 active-forgetting checkpoints a secondary set with the same contrast, outside Holm; both are run, and no deletion mechanism is built.

**Why.** He took the sheet's recommendations on 2026-11-19 for every item except 1, 16 and 20, and this item's evidence and alternatives are on the sheet.

**Result.** The item's answer line reads "accept (2026-11-19)", and v1 states the value without the "(recommended; ...)" mark (`docs/research/preregistration.md`).

**Consequence.** `gatemem_primary` stays `"access"`; ADR 0030 and the backlog row record the answer.
