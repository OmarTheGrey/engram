---
date: 2026-11-21
author: claude-agent
type: decision
card: E2.10
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/policy/injection-screen.ts
  - packages/core/test/unit/policy/injection-screen.test.ts
supersedes: none
---

**What.** A rule's time bound is a bound on what it reads: 100,000 characters per reading; longer content fails closed and is held, unread. Each rule's timeout test runs 27 adversarial inputs at that length under both profiles and must finish in 1.5 s and not fail closed.

**Why.** Core reads no clock, and a wall-clock timeout would make the same write held on a slow machine and admitted on a fast one, breaking replay and the corpus result's byte stability.

**Result.** Deterministic. AMSB's vol-overflow (150,000 characters) is held by this bound under both profiles.

**Consequence.** A large document written with the screen on is held for review; if that proves costly, the bound is a constant to raise after a timeout test at the new size.
