---
date: 2026-10-25
author: claude-agent
type: decision
card: E2.2
chapter: design
pillar: plane
hypothesis: H1
evidence:
  - packages/core/test/property/invariants.test.ts
  - packages/core/test/property/oracle.ts
  - "make test-invariants"
  - https://github.com/OmarTheGrey/engram/issues/1
supersedes: none
---

**What.** The lead-owned invariants file now builds the real Plane (`createPlane`) instead of the stub, asserts invariants 1 and 2 directly (the `redUntilPlane` wrappers are gone), and runs 1,000 cases per invariant instead of 300; the oracle is unchanged.

**Why.** Cards E2.2 and E2.3 close issue #1, so the expected-failure mode had to go.

**Result.** All four invariants pass under `make test` and `make test-invariants`. Invariant 1 now stores its items under an admit-all write policy and reads under the random one, makes half the readers members of some item scopes, and fails unless the run admits an item by scope and one by grant. Mutants that drop membership, the matrix, grant expiry, class, pattern or honouring each fail invariant 1.

**Consequence.** Needs the second reviewer the testing convention requires. `createStubPlane` is removed.
