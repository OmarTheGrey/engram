---
date: 2026-11-21
author: claude-agent
type: change
card: E8.14
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/plane/read.ts
  - packages/core/src/plane/scopes.ts
  - packages/core/src/plane/read-reason.ts
  - packages/core/test/unit/plane/read-by-id.test.ts
  - packages/core/test/property/read-by-id.test.ts
  - "make test-one T=packages/core/test/unit/plane/read-by-id.test.ts"
supersedes: none
---

**What.** Two Plane methods for framework adapters: `readById(actor, itemId, {at, valid_at?})` and `listScopes(actor, at)`.

**Why.** Card E8.14 step 1: a key-value framework seam (research note AB-FWK-1) needs both, through the gate of `Plane.read`.

**Result.** `readById` is the read path with at most one candidate, the item under the id when reachable: the same filter, explanation and read event, no store search; its reason ends `; read by id <id>` (`readByIdTarget`). An unreachable id answers as an unknown one. `listScopes` lists readable member scopes and scopes of items a live grant admits, in one read event (`scope list: `). 20 unit tests and 2 property tests of 300 runs pass.

**Consequence.** Existing reads are unchanged; no registered condition calls the new methods.
