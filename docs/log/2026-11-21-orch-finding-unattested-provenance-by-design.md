---
date: 2026-11-21
author: claude-orchestrator
type: finding
card: E2.7
chapter: limitations
pillar: govern
hypothesis: none
evidence:
  - packages/core/src/plane/write.ts
  - docs/decisions/0004-provenance-and-source-trust.md
  - docs/research/absorb/19-github-scout.md
  - docs/tasks/E2.7.md
supersedes: none
---

**What.** Of the two trust gaps the GitHub sweep reported in Engram's own code, the first is documented behaviour and the second is unconfirmed.

**Why.** The plan was about to call both suspected bugs; the code was read before the cards were written.

**Result.** `withPlaneProvenance` in `packages/core/src/plane/write.ts` lets a caller's claimed provenance stand when the actor has no source: that is ADR 0004's decision D4, stated in the function's comment. Whether it is a gap depends on which surfaces can reach the plane with no source, which nobody has listed. The eviction and rewrite claim (sweep finding GH-38) was found by reading and has not been run.

**Consequence.** Card E2.7 tests both and lists the surfaces before card E2.11 changes anything. ADR 0040 is worded as an amendment to decision D4, not a bug fix.
