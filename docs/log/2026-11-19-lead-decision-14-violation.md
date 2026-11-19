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
  - docs/research/preregistration.md
supersedes: docs/log/2026-11-03-pr4b-lp-decision-violation.md
---

**What.** The lead accepted the recommendation of decision sheet item 14: a GateMem violation is the judge's leak verdict at an access-control or forgetting checkpoint, a wrong action alone is not one, and the gate-by-action table gives the paper's Eqs. 11 and 12 beside it; MEM-INV-Bench is scored as upstream scores it, HIT over HIT and REFUSED.

**Why.** He took the sheet's recommendations on 2026-11-19 for every item except 1, 16 and 20, and this item's evidence and alternatives are on the sheet.

**Result.** The item's answer line reads "accept (2026-11-19)", and v1 states the value without the "(recommended; ...)" mark (`docs/research/preregistration.md`).

**Consequence.** `decides` stays true only in the primary table; no table code changes.
