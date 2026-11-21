---
date: 2026-11-21
author: claude-agent
type: decision
card: E2.9
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/policy/secrets.ts
  - packages/core/test/unit/policy/secrets.test.ts
supersedes: none
---

**What.** The unchanged-rewrite skip also needs the grants unchanged or narrowed: every grant of the rewrite must already be on the item, compared as canonical JSON.

**Why.** A rewrite that only adds a grant widens who reads the content, which the guard judged nowhere (V-9).

**Result.** Tested: keeping or removing the grant is not judged; adding a second grantee to an item holding a key is denied under block.

**Consequence.** An expiry respelled as another instant string reads as a new grant and is judged; that errs toward judging.
