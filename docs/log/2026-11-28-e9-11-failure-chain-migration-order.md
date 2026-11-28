---
date: 2026-11-28
author: claude-agent
type: failure
card: E9.11
chapter: implementation
pillar: twin
hypothesis: none
evidence:
  - packages/core/test/unit/log/chain.test.ts
  - pnpm exec vitest run --project @engram/core
supersedes: none
---

**What.** The core project run failed 3 of 3597 tests: the chain's migration-order test on both backends, and the secrets rule-timing test.

**Why.** The chain test lists the migrations it applies before migration 5 as `[1, 2, 3, 4, 6]`, and migration 7 joined them. The timing test measures rule speed under the machine's load.

**Result.** "Tests 3 failed | 3593 passed | 1 skipped (3597)". The chain test's list now names 7, its meaning unchanged (5 still applies after later ones): "Tests 22 passed (22)". The secrets file passed alone: "Tests 242 passed (242)", so that failure was load.

**Consequence.** A later migration updates that list too.
