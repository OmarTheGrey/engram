---
date: 2026-11-21
author: claude-agent
type: finding
card: E2.13
chapter: limitations
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/plane/who-can-read.ts
  - packages/core/src/visible.ts
  - packages/core/test/property/who-can-read.test.ts
supersedes: none
---

**What.** What each asker learns, against what it knew. A grantee is answered only while `evaluateRead` admits the item, so it learns the item exists only when a read would return it; an expired grant, a grant of another class or a closed item gets the unknown id's refusal, so a grant-reached candidate reveals nothing (E8.14's review concern). A scope member learns the item's status, owner and readers; it already sees the item's events in that scope.

**Why.** Item 53: the least disclosure that answers.

**Result.** One addition: for a candidate or retired item, a member who may not read it learns its owner's id, which its events name only when the owner wrote them (a first write may name another owner, ADR 0034's first limit).

**Consequence.** For the lead. If that is too much, withhold `owner` from a member the read filter does not admit; one line.
