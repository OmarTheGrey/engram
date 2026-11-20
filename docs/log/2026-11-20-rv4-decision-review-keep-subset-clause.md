---
date: 2026-11-20
author: claude-agent
type: decision
card: RV4
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/core/test/unit/plane/adopt-review.test.ts
  - packages/core/src/plane/commit.ts
supersedes: none
---

**What.** For I-8, both clauses are kept and tested, not removed: the subset check in `sameAsWritten` and the provenance equality of `asHeld`.

**Why.** Removing the subset check would make an adoption carrying a grant the writer never wrote count as the writer's own bytes, so the writer's commit would pass the staleness check over a change it did not make. The provenance clause keeps a frontmatter edit from inheriting the plane's provenance.

**Result.** Two unit tests kill M4 and M5.

**Consequence.** None.
