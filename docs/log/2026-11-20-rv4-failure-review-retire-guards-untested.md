---
date: 2026-11-20
author: claude-agent
type: failure
card: RV4
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/test/unit/plane/adopt-review.test.ts
supersedes: none
---

**What.** Review finding I-2 of PR #58: three guards of a re-keyed record's retirement survived every test. M3 (`holders.every(vacated)` as `.some`), M2 (`!present.has(held.id)` removed from `vacated`) and M1 (the touched-since-listing guard removed) each left the suite green.

**Why.** Card RV4's tests moved a whole folder, where every holder is vacated, in one scope, on one handle; none had a still-listed holder, a holder in another scope, or a change after the listing.

**Result.** Three tests on a re-keying fake store: a holder the store still lists fails closed; mixed holders, one in another scope, fail closed and retire nothing; a holder changed on a second handle after the listing is deferred. Each mutation now fails exactly its test.

**Consequence.** None beyond the tests; the guards were right.
