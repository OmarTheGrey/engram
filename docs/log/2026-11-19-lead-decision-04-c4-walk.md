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
  - research/results/h1-c4-walk.json
  - docs/decisions/0031-c1-and-c4-on-each-benchmark.md
supersedes: docs/log/2026-11-03-pr4b-fr-decision-c4-walk.md
---

**What.** The lead accepted the recommendation of decision sheet item 4: C4 on GateMem walks the shared ranking until it has passed as many allowed items as C5 returns (ADR 0031, decision 4), so C4's allowed items are C5's list in C5's order; v1's analysis reports the walk's bias both ways.

**Why.** He took the sheet's recommendations on 2026-11-19 for every item except 1, 16 and 20, and this item's evidence and alternatives are on the sheet.

**Result.** The item's answer line reads "accept (2026-11-19)", and v1 states the value without the "(recommended; ...)" mark (`docs/research/preregistration.md`).

**Consequence.** The runner's C4 read is unchanged; no ADR supersedes ADR 0031.
