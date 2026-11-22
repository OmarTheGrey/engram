---
date: 2026-11-22
author: claude-agent
type: failure
card: E2.11
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/plane/promote.ts
  - "make test-one T=packages/core/test/counterexamples/trust.test.ts"
supersedes: none
---

**What.** A promotion asked the budget refusal only at its decision, not in the transaction that commits it (review E2.11-1).

**Why.** The write path got the recheck; the promotion path was missed, and `protect-trusted`, `decision-scope-of-protection` and the architecture said both had it.

**Result.** The reviewer's probe: another handle lands a user semantic item during a tool promotion's store write; the promotion was allowed and the scope ended at 2 active items against a budget of 1. The new trust test failed on it (`expected { ...(13) } to match object { op: 'promote', ... }`), and passes with the recheck, which refuses under `engram/write/downgrade`.

**Consequence.** Those claims are true from this pass.
