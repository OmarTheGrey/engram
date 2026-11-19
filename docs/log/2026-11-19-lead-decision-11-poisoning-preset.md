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
  - research/results/h1-mem-inv-admission.json
supersedes: docs/log/2026-11-03-pr4b-fr-decision-poisoning-preset.md
---

**What.** The lead accepted the recommendation of decision sheet item 11: C5 enforces medium on MEM-INV-Bench, H1's preset on both arms, and the arm stays in H1's decision as a check that can only contradict it.

**Why.** He took the sheet's recommendations on 2026-11-19 for every item except 1, 16 and 20, and this item's evidence and alternatives are on the sheet.

**Result.** The item's answer line reads "accept (2026-11-19)", and v1 states the value without the "(recommended; ...)" mark (`docs/research/preregistration.md`).

**Consequence.** `preset` in `research/configs/h1-mem-inv.json` stays medium; no table code changes.
