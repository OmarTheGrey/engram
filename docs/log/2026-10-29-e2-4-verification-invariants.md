---
date: 2026-10-29
author: claude-agent
type: decision
card: E2.4
chapter: design
pillar: plane
hypothesis: H1
evidence:
  - packages/core/test/property/invariants.test.ts
  - packages/core/test/property/oracle.ts
  - "make test-invariants"
supersedes: docs/log/2026-10-29-e2-4-review-invariants.md
---

**What.** The lead-owned invariants change a third time: invariant 2 also generates a restating write after an item planted as retired, written with status retired or retired only by its own ttl, and requires it to land; its oracle ignores own-ttl retirements; the oracle's `sameContent` strips default-ignorable code points and applies NFKC again; invariant 5's sweep oracle treats only a `person:` scope as an actor's own.

**Why.** The verification showed invariant 2 stayed green when the P4-3 fix was broken, and findings P4-13 to P4-15 change what the oracle must say.

**Result.** Breaking the P4-3 or the P4-13 fix now turns invariant 2 red. A guard requires planted cases. `make test-invariants`: 5 passed.

**Consequence.** Second reviewer: the orchestrator's verification of this branch, then the lead.
