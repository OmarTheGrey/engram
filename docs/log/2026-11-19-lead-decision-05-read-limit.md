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
  - docs/log/2026-11-02-x1r3-floor-recall.md
supersedes: docs/log/2026-11-03-pr4b-decision-read-limit.md
---

**What.** The lead accepted the recommendation of decision sheet item 5: a read returns 20 items in C2, C3 and C5 (and on MEM-INV-Bench in C4), GateMem's RAG-Policy `top_k` at its pin.

**Why.** He took the sheet's recommendations on 2026-11-19 for every item except 1, 16 and 20, and this item's evidence and alternatives are on the sheet.

**Result.** The item's answer line reads "accept (2026-11-19)", and v1 states the value without the "(recommended; ...)" mark (`docs/research/preregistration.md`).

**Consequence.** `read_limit` stays 20 in both H1 configs.
