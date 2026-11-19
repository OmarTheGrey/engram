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
  - research/configs/h1-gatemem.json
supersedes: docs/log/2026-11-03-pr4b-fr-decision-store.md
---

**What.** The lead accepted the recommendation of decision sheet item 2: H1's two arms run on Mem0, the runner's in-process Mem0 with `infer: false`, the hashing embedder and a model slot that refuses every call; v1 says H1 exercises Mem0's storage and listing, not its extraction or semantic retrieval.

**Why.** He took the sheet's recommendations on 2026-11-19 for every item except 1, 16 and 20, and this item's evidence and alternatives are on the sheet.

**Result.** The item's answer line reads "accept (2026-11-19)", and v1 states the value without the "(recommended; ...)" mark (`docs/research/preregistration.md`).

**Consequence.** The `store` field of the three H1 configs stays `mem0`.
