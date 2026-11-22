---
date: 2026-11-22
author: claude-agent
type: decision
card: E8.14
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/plane/scopes.ts
  - packages/core/src/dogfood.ts
  - packages/core/test/unit/dogfood-report.test.ts
supersedes: docs/log/2026-11-21-e8-14-decision-scope-list-as-read-event.md
---

**What.** A scope listing stays a `read` event with no item ids and a `scope list: ` reason, and the dogfood report now counts it apart.

**Why.** Review finding E8.14-8: the earlier entry said the report counted it as a read.

**Result.** `reads.scope_lists` counts such events (report format `engram-dogfood-report/3`); one that names an item is judged as a read whatever its reason says, so a forged listing cannot hide a returned item (two tests). `/scopes` runs the store sync first, as `/read/{itemId}` does (E8.14-11).

**Consequence.** A member's report from before this change reads format 2.
