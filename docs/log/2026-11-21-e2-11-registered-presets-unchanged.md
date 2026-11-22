---
date: 2026-11-21
author: claude-agent
type: milestone
card: E2.11
chapter: evaluation
pillar: plane
hypothesis: none
evidence:
  - packages/core/test/unit/policy/trust-registered.test.ts
  - "make test-one T=packages/core/test/unit/policy/trust-registered.test.ts"
supersedes: none
---

**What.** A test pins every registered preset's decisions byte for byte to what main decided before this card.

**Why.** ADR 0040, decision 6, and the pre-registration guard: no registered condition may move.

**Result.** One fixed workload (sourceless claims, less trusted rewrites and retires, evictions, promotion, adoption of hand edits, sweeps, a check, a read) runs under strict, medium and permissive as registered and with every budget one; the sha256 of its events, items and results was computed at 0e15f8b8 before any change and is fixed in the file, six digests. With the trust block absent or explicitly off the digests match after the card: 5 tests pass.

**Consequence.** Any later change to a registered decision on this path fails the test.
