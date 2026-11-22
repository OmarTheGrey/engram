---
date: 2026-11-21
author: claude-agent
type: failure
card: E1.6
chapter: evaluation
pillar: plane
hypothesis: none
evidence:
  - packages/core/test/property/chain.test.ts
supersedes: none
---

**What.** On Postgres the chain property failed its own guard: no run met an edited lint evidence.

**Why.** Postgres runs ten cases; none happened to hold a salted lint event after the offboarding.

**Result.** Each run now lints every surviving scope after the offboarding; both backends pass with every tamper met.

**Consequence.** A guard that fails on the smaller backend is a reason to make the generator reach the case, not to drop the guard.
