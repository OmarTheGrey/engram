---
date: 2026-11-19
author: claude-agent
type: failure
card: RV1
chapter: implementation
pillar: research
hypothesis: H1
evidence:
  - packages/runner/src/research/h1-sessions.ts
  - packages/runner/test/rv1-review.test.ts
  - "pnpm --filter runner exec vitest run test/rv1-review.test.ts"
supersedes: none
---

**What.** The review (RV1-2) found the turn-limit exclusion in H1's converter untested: removing all four guards left every test passing.

**Why.** The first pass tested the cap on GateMem's probe only, and relied on the guards' reading for the converter and for MEM-INV-Bench and LongMemEval.

**Result.** Added one converter test per guard (a capped access session is excluded, a capped utility session has a null `utility_ok`, a capped MEM-INV-Bench HIT is excluded, a capped UNREAD session is not in the readers' template) and a probe test with `turn_limit` on MEM-INV-Bench and on LongMemEval (excluded from the summary; LongMemEval's capped session is not judged). With the four guards removed, the four converter tests fail.

**Consequence.** Nothing in the code changed; the exclusion is now held by tests.
