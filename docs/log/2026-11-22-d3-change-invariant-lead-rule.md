---
date: 2026-11-22
author: claude-agent
type: change
card: D3
chapter: implementation
pillar: distill
hypothesis: H5
evidence:
  - packages/core/src/oracle.ts
  - packages/core/test/property/invariants.test.ts
  - "make test-invariants"
supersedes: none
---

**What.** The oracle's `replayAdmits` reads the lead's rule: exactly `replay_n` tasks, the registered 2/3, and passes at two thirds of a task's runs and no less than the baseline. Invariant 2's replay cases gain baselines, a third-seed miss and a guard for a refusal only the no-worse rule makes.

**Why.** Review finding D3-5's oracle had to follow the rule. The lead-owned files still need their second reviewer.

**Result.** Replay cases are one in five, with no restatements and no review, and the owner presents them. `make test-invariants`: 17 passed. Each mutation fails invariant 2 on the oracle: no-worse, size check, validation-source rule, ref check.

**Consequence.** Invariants 1 and 3 to 8 are untouched.
