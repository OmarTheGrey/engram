---
date: 2026-11-21
author: claude-agent
type: decision
card: E8.14
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/test/property/invariants.test.ts
  - "make test-invariants"
supersedes: none
---

**What.** The two new Plane methods are classified in the surface check of the invariants file, which the lead owns, by an additive change.

**Why.** The check fails by design on any Plane method it does not classify, and `make test-invariants` is part of the acceptance.

**Result.** `readById` is called by an outsider on the hidden item and on an unknown id (the same items, explanations and filtered count, and no secret), and `listScopes` must not list the hidden scope. Nothing else in the file changed. `make test-invariants`: 17 of 17 pass.

**Consequence.** By the testing convention this change needs a second reviewer.
