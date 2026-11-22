---
date: 2026-11-21
author: claude-agent
type: change
card: E2.11
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/policy/trust.ts
  - packages/core/src/plane/write.ts
  - "make test-one T=packages/core/test/counterexamples/trust.test.ts"
supersedes: none
---

**What.** `trust.unattested_floor` is enforced: with it on, a write whose actor sets no source is recorded at kind `external`, the least trusted in core's order, as that actor's, whatever it claimed.

**Why.** ADR 0040, decision 2, for gap GH-39, which card E2.7 confirmed reaches the write gate, promotion's confirmations and the retired-content rule.

**Result.** `unattestedFloor` in `policy/trust.ts`, called from `withPlaneProvenance` before `evaluateWrite`, so every consumer of the kind sees the floored one; the reason says `provenance floored by the plane (trust.unattested_floor)` and names the claim. E2.7's GH-39 cases flip under the options: the team write is denied, the confirmations count nothing (`engram/promote/no-evidence`), the restatement is denied (`engram/write/retired-content`), the simulator agrees. Mutation: the floor removed, 7 of the trust file's cases and invariant 8 fail.

**Consequence.** Library callers and HTTP clients that send no source write at the lowest trust when a policy turns the floor on.
