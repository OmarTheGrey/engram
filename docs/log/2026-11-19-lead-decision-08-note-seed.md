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
  - docs/decisions/0031-c1-and-c4-on-each-benchmark.md
supersedes: docs/log/2026-11-03-pr4b-decision-note-seed.md
---

**What.** The lead accepted the recommendation of decision sheet item 8: MEM-INV-Bench's agent note is written once per case and model with the config's first seed and serves all three seeds, as upstream writes one note per scenario and model: 8 calls.

**Why.** He took the sheet's recommendations on 2026-11-19 for every item except 1, 16 and 20, and this item's evidence and alternatives are on the sheet.

**Result.** The item's answer line reads "accept (2026-11-19)", and v1 states the value without the "(recommended; ...)" mark (`docs/research/preregistration.md`).

**Consequence.** The note writer in `packages/runner/src/mem-inv-probe.ts` is unchanged.
