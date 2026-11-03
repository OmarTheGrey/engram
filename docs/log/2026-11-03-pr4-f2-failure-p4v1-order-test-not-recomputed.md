---
date: 2026-11-03
author: claude-agent
type: failure
card: R1
chapter: implementation
pillar: research
hypothesis: H1
evidence:
  - packages/runner/src/research/h1-sessions.ts
  - packages/runner/test/research/h1-sessions.test.ts
supersedes: none
---

**What.** The blind template's order test checked only that the order differs from the sessions' and is seeded; a ranking that put the condition first, which un-blinds the readers, would have passed (P4V-1).

**Why.** The test asserted properties of the order instead of the order itself.

**Result.** The test recomputes the order (sorted by the sha256 of `${seed}\n${sessionKey}`) and compares; the condition-first mutant fails it (`2026-11-03-pr4-f2-blind-order-test`).

**Consequence.** Where the expected value is computable, a test computes it.
