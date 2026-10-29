---
date: 2026-10-25
author: claude-agent
type: change
card: E2.3
chapter: implementation
pillar: plane
hypothesis: H1
evidence:
  - packages/core/src/plane/write.ts
  - packages/core/src/plane/read.ts
  - packages/core/src/policy/evaluate.ts
  - packages/core/src/actor.ts
  - packages/core/src/time.ts
  - packages/core/test/unit/plane/write.test.ts
  - packages/core/test/unit/plane/read.test.ts
  - packages/core/test/property/read-leak.test.ts
  - packages/adapters/test/plane/acceptance.test.ts
  - "make test-invariants"
supersedes: none
---

**What.** Fixes for the fourteen review findings on the Plane PR (PR #5, cards E2.2 and E2.3), applying decisions D4 to D7.

**Why.** Reads leaked hidden match counts through relevance and `filtered`; anyone could write into any scope, claim any provenance and grant to everyone; a store failure or an invalid time left bytes without an event; sub-millisecond timestamps compared equal.

**Result.** The gate checks membership, rewrite owner and version, and grants; the plane sets provenance from `Actor.source`; store failures are deny events; reads search only reachable scopes and rank among admitted items; `explain` takes the actor; one timestamp helper compares at full precision. Each finding has a test that failed first; fourteen mutants were killed, including relevance over all hits, which a property over generated scopes, grants and queries catches. `make test`: 696 pass, 13 skip.

**Consequence.** Downstream callers must pass the actor to `explain` and set `Actor.source`.
