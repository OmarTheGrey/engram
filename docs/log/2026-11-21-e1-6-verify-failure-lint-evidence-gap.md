---
date: 2026-11-21
author: claude-agent
type: failure
card: E1.6
chapter: evaluation
pillar: plane
hypothesis: none
evidence:
  - packages/core/test/unit/log/attacks.test.ts
  - packages/core/src/log/verify.ts
supersedes: none
---

**What.** The E1.6-3 fix left lint evidence erasable: a manifest reusing a real erase event could name a surviving lint event whose evidence was blanked and whose salt was deleted.

**Why.** E1.6-3 tied item events to the erase events' items but accepted any lint event beside any erase event, since a lint event may be about another item; and erasing evidence leaves the leaf hash unchanged, so even a held checkpoint saw nothing.

**Result.** Verify said UNSIGNED, and OK after the next routine checkpoint (the verification's reproduction). Fixed by the adjacency rule; the three attacks were red before it.

**Consequence.** An erasure's evidence is bound to the transaction that made it, not only to its items.
