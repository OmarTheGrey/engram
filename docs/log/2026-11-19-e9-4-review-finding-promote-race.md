---
date: 2026-11-19
author: claude-agent
type: finding
card: E9.4
chapter: limitations
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/plane/promote.ts
  - docs/tasks/backlog.md
supersedes: none
---

**What.** `Plane.promote` has review finding C1's pattern for in-place promotions: it awaits the store write and appends its allow event without reading the item again under the log's lock.

**Why.** The reviewer of PR #44 pointed at `packages/core/src/plane/promote.ts` and asked for it to be recorded, not fixed in card E9.4 (one card per PR).

**Result.** Not reproduced here; by the same reasoning, an erasure or change committed by another process during the promotion's store write is undone by its allow event.

**Consequence.** A backlog row (`docs/tasks/backlog.md`, follow-ups from card E9.4): the fix is ADR 0034, decision 5's, applied to promotion.
