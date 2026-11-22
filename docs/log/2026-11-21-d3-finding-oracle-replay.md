---
date: 2026-11-21
author: claude-agent
type: finding
card: D3
chapter: limitations
pillar: distill
hypothesis: H5
evidence:
  - packages/core/src/oracle.ts
  - packages/core/test/property/invariants.test.ts
supersedes: none
---

**What.** The invariants' oracle (`promotionPermitted`) still says a procedural candidate never lands, and invariant 2 never presents a replay.

**Why.** D3 opens a promotion path the oracle cannot judge, since the replay is not in the log.

**Result.** Sound today (`make test-invariants`: 17 passed), but invariant 2 does not cover replay admissions.

**Consequence.** For the lead (the file is his): extend the oracle with the presented replay, or record replays in the log in a schema card.
