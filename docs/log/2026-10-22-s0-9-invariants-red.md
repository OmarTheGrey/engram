---
date: 2026-10-22
author: omar
type: change
card: S0.9
chapter: implementation
pillar: plane
hypothesis: H1
evidence:
  - packages/core/test/property/invariants.test.ts
  - packages/core/src/plane.ts
  - packages/core/test/generators.ts
  - "make test-invariants"
  - https://github.com/OmarTheGrey/engram/issues/1
supersedes: none
---

**What.** Step-0 task S0.9 added the invariants file: fast-check generators for policies, scopes, grants, items and actors, and the four invariants of the testing convention asserted against the `Plane` interface, whose only implementation is a stub that admits everything.

**Why.** The invariants are the promises H1 rests on; they must exist, and fail, before the policy engine is written.

**Result.** 1,000 cases per invariant. Invariants 1 and 2 fail with a readable counterexample and a printed seed (a read returning an org item to a person with no membership or grant; an episodic user-sourced item landing where policy forbids it); invariants 3 and 4 pass. Generators are checked to produce only schema-valid values.

**Consequence.** The file runs in its own CI job with continue-on-error and is excluded from `make test` until E2.1 (issue #1). Its read and write oracles are a design commitment for ADR 0006.
