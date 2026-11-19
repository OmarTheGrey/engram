---
date: 2026-11-19
author: claude-agent
type: decision
card: E2.6
chapter: design
pillar: twin
hypothesis: none
evidence:
  - packages/core/src/plane/commit.ts
  - docs/decisions/0007-write-gate-and-source-isolation.md
  - packages/core/test/unit/plane/cross-handle-review.test.ts
supersedes: docs/log/2026-11-19-e2-6-finding-adoption-stale-bytes.md
---

**What.** A writer ignores an adoption that recorded exactly its own bytes when its decision stands, and when it is stale, settling withdraws such an adoption: the item is restored as it stood before it by one allowed event, `engram/adopt/withdrawn`, appended with the writer's deny.

**Why.** The adoption recorded bytes whose decision never stood. An intent event before every store write would add an event per write, breaking invariant 3's one event, and leave a crashed writer's intent open; refusing adoptions at an equal version would refuse an owner's hand edit.

**Result.** RV8: Sam reads nothing and the removal stands; removing the withdrawal fails RV8 on both backends.

**Consequence.** An owner's hand edit identical to a stale write's bytes would be withdrawn too.
