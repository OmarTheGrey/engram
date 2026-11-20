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

**What.** Review finding I-8 of PR #58: the subset check of `sameAsWritten` (`commit.ts`, M4) and the provenance-equality clause of `asHeld` (`write.ts`, M5) survived every test.

**Why.** Nothing built an adoption carrying a grant its writer had not written, nor a record whose provenance alone was edited.

**Result.** Two unit tests: `ownBytes` is false for an adoption carrying a grant the writer did not write and true for a subset; `adoptedItem` records a record with only its provenance edited as the adopter's `import`. M4 and M5 now fail them (decision entry: both clauses kept).

**Consequence.** None beyond the tests.
