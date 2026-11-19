---
date: 2026-11-20
author: claude-agent
type: finding
card: RV4
chapter: limitations
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/plane/commit.ts
  - packages/core/test/unit/plane/cross-handle-verify.test.ts
supersedes: none
---

**What.** With adoption keeping only grants the plane's item carries, the stale writer's narrowing (`engram/adopt/narrowed`, card E2.6) has nothing to remove in the orderings it was built for.

**Why.** Narrowing removes grants an adoption of stale bytes carried that the version before it lacked; an adoption's grants are now a subset of that version's, so the set is empty.

**Result.** Orderings V9 and Q3b of `cross-handle-verify.test.ts` now show no narrowing event, the adoption's own reason naming the dropped grant. The code stays as defence in depth; the dogfood report still judges a narrowing if one appears.

**Consequence.** The lead may remove the narrowing in a later card, or keep it. Nothing changes here.
