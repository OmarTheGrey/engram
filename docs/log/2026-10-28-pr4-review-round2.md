---
date: 2026-10-28
author: claude-agent
type: change
card: E2.2
chapter: implementation
pillar: plane
hypothesis: H1
evidence:
  - packages/core/src/plane/read.ts
  - packages/core/src/plane/write.ts
  - packages/core/src/policy/evaluate.ts
  - packages/core/test/property/read-leak.test.ts
  - packages/core/test/unit/plane/write.test.ts
  - docs/decisions/0007-write-gate-and-source-isolation.md
  - docs/decisions/0009-retrieval-explanations.md
  - "make test"
supersedes: none
---

**What.** Round 2 of PR #5's review fixes (E2.2, E2.3): findings N1 to N5.

**Why.** A capped store search let hidden items crowd out a granted one (N1). Concurrent writes passed rewrite checks against a stale projection (N2). Denials named another scope's item (N3). A colliding ref left unnamed orphaned bytes (N4).

**Result.** The store is searched only in readable member scopes, and grant-only items are matched by the plane. Writes per db handle queue, chosen over a re-check after the store has written. A writer who cannot read the held item gets an opaque reason. The collision event names the contract breach and the orphaned bytes. Each new test in read-leak.test.ts and write.test.ts failed first. Removing the queue fails both race tests, and searching granted scopes fails the leak tests.

**Consequence.** ADR 0009 drops its capped-search limit. ADR 0007 records the queue's cross-process limit.
