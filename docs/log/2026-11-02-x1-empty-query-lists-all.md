---
date: 2026-11-02
author: claude-agent
type: decision
card: X1
chapter: design
pillar: research
hypothesis: H1
evidence:
  - packages/runner/src/conditions.ts
  - packages/runner/test/conditions.test.ts
  - docs/log/2026-11-02-x1-mem0-empty-query.md
supersedes: none
---

**What.** In C2, C3 and C4 a `memory_read` whose query has no terms lists every item of every scope the store holds, instead of asking the store's search.

**Why.** The plane's read already treats a query without terms as "everything I may see"; a store whose search returns nothing for it (Mem0) would otherwise make the conditions differ by retrieval, which the runner keeps equal.

**Result.** A test with a store whose search always returns nothing still shows the item to the model. `make fixtures` re-recorded RN1, B3 and B4 with no cassette changed, since their reads either have terms or hold one scope.

**Consequence.** A query with terms still meets each store's own search, which is what C2 to C4 measure.
