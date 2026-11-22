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
  - packages/core/src/policy/evaluate.ts
  - packages/core/src/policy/retention.ts
  - packages/core/src/plane/retention.ts
  - packages/core/src/plane/promote.ts
  - packages/core/src/plane/adopt.ts
  - "make test-one T=packages/core/test/counterexamples/trust.test.ts"
supersedes: none
---

**What.** `trust.protect_trusted` is enforced: a rewrite or retire of an active item at a less trusted kind is denied (`engram/write/downgrade`), and a budget eviction never chooses a victim more trusted than its trigger.

**Why.** ADR 0040, decision 3, for gap GH-38, which card E2.7 confirmed under every registered preset in team scope.

**Result.** `downgradeProblem` runs in `evaluateWrite` after the grant rules; `evaluateRetention` takes `mayEvict`; `budgetRefusal` denies a write or promotion whose landing would need a more trusted victim, at the decision and again in the committing transaction; sweeps evict at the sweeper's source. The owner acting as user is exempt. All 21 gap cells of E2.7's lattice flip for rewrite, retire and eviction. Mutations of each piece (the check, the victim filter, the sweep filter, the commit recheck, adoption, promotion) each fail a test.

**Consequence.** Under the option, writes may be denied where a trusted item was evicted.
