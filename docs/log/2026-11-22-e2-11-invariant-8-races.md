---
date: 2026-11-22
author: claude-agent
type: change
card: E2.11
chapter: evaluation
pillar: plane
hypothesis: none
evidence:
  - packages/core/test/property/invariants.test.ts
  - "make test-invariants"
supersedes: docs/log/2026-11-21-e2-11-invariant-8.md
---

**What.** Invariant 8 now walks promotions and races on two handles over one log, besides writes, rewrites, retires, sweeps and adoptions.

**Why.** Review E2.11-2: the walk must see the commit-time rechecks.

**Result.** A race lands a write on a second handle (its own Db object, so its own queue) between a write's or a promotion's decision and its commit on the first. Every landing's budget check, a promotion's included, evicts exactly the oracle's eligible victims; a sweep's recorded shortfall is checked once per state. Thirteen guards, all met. Mutations killed by invariant 8: the promotion and the write commit rechecks, the downgrade check, the floor, the write and the sweep eviction filters, adoption's keep, the sweep's shortfall record. Two survive by design: each decision-time refusal, which the commit recheck repeats; the trust tests kill both.

**Consequence.** Invariants 1 to 7 and their generators are unchanged.
