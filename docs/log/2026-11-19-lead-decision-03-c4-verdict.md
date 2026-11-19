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
  - research/results/h1-c4-verdict-agreement.json
  - docs/decisions/0031-c1-and-c4-on-each-benchmark.md
supersedes: docs/log/2026-11-03-pr4b-decision-c4-verdict.md
---

**What.** The lead accepted the recommendation of decision sheet item 3: C4's verdict on GateMem is the plane's own read decision (`c4_verdicts: "engram"`, core's `evaluateRead` under the preset C5 enforces), so C4 and C5 apply one policy and C4 minus C5 measures told against enforced.

**Why.** He took the sheet's recommendations on 2026-11-19 for every item except 1, 16 and 20, and this item's evidence and alternatives are on the sheet.

**Result.** The item's answer line reads "accept (2026-11-19)", and v1 states the value without the "(recommended; ...)" mark (`docs/research/preregistration.md`).

**Consequence.** `research/configs/h1-gatemem.json` keeps `c4_verdicts: "engram"`; `gatemem-rag` stays runnable, unused by H1.
