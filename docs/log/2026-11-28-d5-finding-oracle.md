---
date: 2026-11-28
author: claude-agent
type: finding
card: D5
chapter: evaluation
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/oracle.ts
  - packages/core/test/property/invariants.test.ts
supersedes: none
---

**What.** The invariants' promotion oracle (`promotionPermitted`) does not know the safety scan, so it would call a held admission permitted.

**Why.** Invariant 2 checks that what lands is permitted, never that what is permitted lands, so a plane stricter than the oracle passes; and no registered or generated policy sets the option.

**Result.** No invariant test changed (the file is the lead's). The hold is pinned by `procedural.test.ts` on the real Plane instead.

**Consequence.** If H5 ever arms the scan, the lead may want the oracle to check that no procedural item with a critical finding lands under hold without a release event.
