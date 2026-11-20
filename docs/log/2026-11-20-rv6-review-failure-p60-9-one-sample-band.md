---
date: 2026-11-20
author: claude-agent
type: failure
card: RV6
chapter: evaluation
pillar: research
hypothesis: none
evidence:
  - packages/runner/src/research/check-runs.ts
  - packages/runner/test/rv6-checks.test.ts
supersedes: none
---

**What.** The proposed B1 band counted only the replication's sampling error, by the normal approximation, which fails at F's small rate (review P60-9).

**Why.** The paper's rates are themselves samples of the Medical checkpoints, and the normal interval at p = 0.023 is too narrow and can go below zero.

**Result.** The band is now two-sample and Wilson based (`b1Band`, `check-runs.ts b1-band`); the proposal is superseded. Tests pin it at 40 to 50, 0 to 12 and 0 to 6 of 50, and dropping the paper's own error moves A's floor to 1 and F's ceiling to 5, which fails them.

**Consequence.** Section 7 of the plan names the new band.
