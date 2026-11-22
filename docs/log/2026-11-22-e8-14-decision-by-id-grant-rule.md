---
date: 2026-11-22
author: claude-agent
type: decision
card: E8.14
chapter: design
pillar: plane
hypothesis: none
evidence:
  - docs/decisions/0047-by-id-read-and-scope-list.md
  - packages/core/src/plane/read.ts
  - packages/core/test/unit/plane/read-by-id.test.ts
supersedes: none
---

**What.** A by-id read drops, before counting, a candidate the read filter does not admit and that is not in a scope the reader may read (the lead's decision on review finding E8.14-1, ADR 0047 decision 2).

**Why.** `reachable` counts any grant naming the reader, so an item with a wrong-class or expired grant, or a live grant on an inactive item, answered `filtered: 1` where an unknown id answered 0.

**Result.** Such an id now answers as an unknown id: whole response and reason equal once ids are neutral, checked for four such items in the unit test, by a 300-run property, in the server contract test, and for an outsider with a wrong-class grant in the invariants case. The unit test that expected `filtered: 1` after a grant expired now expects 0.

**Consequence.** A text read is unchanged (see the term-shares finding).
