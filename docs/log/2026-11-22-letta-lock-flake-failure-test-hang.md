---
date: 2026-11-22
author: claude-agent
type: failure
card: none
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - "pnpm exec vitest run packages/adapters/test/letta/letta.test.ts -t \"the wait bounds one holder\""
supersedes: none
---

**What.** The first version of the deterministic lock test hung for its 30 s timeout instead of failing with the lock's refusal.

**Why.** It waited for the waiter to read the test clock four more times after each step. Once the waiter's write was refused it read the clock no more, so the wait never ended.

**Result.** The wait now also ends when the write settles, and the write's error is caught at once and rethrown at the assertion, so no rejection is left unhandled. The test then failed in 439 ms with the same `engram.lock is held by` message as the flake.

**Consequence.** Nothing beyond the test.
