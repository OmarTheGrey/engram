---
date: 2026-11-22
author: claude-agent
type: failure
card: D3
chapter: implementation
pillar: distill
hypothesis: H5
evidence:
  - packages/core/test/property/invariants.test.ts
supersedes: none
---

**What.** The first version of invariant 2's replay cases passed with the plane's ref check removed.

**Why.** Too few cases reached a landing where only the ref check stood in the way, in 1,000 runs. One case in three as replay cases also took the existing guard's `untrustedOnly` to 0.

**Result.** Replay cases went to one in six, which kept every existing guard above 0. A guard now needs a refusal that only the ref's tasks make, and it fails with the ref check removed ("refOnly":0).

**Consequence.** A mutation check is run for each new rule, not only the first.
