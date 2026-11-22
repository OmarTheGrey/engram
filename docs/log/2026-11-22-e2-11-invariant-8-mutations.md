---
date: 2026-11-22
author: claude-agent
type: change
card: E2.11
chapter: evaluation
pillar: plane
hypothesis: none
evidence:
  - packages/core/test/property/invariants.test.ts
  - packages/core/test/counterexamples/trust.test.ts
  - "make test-invariants"
  - "make test-one T=packages/core/test/counterexamples/trust.test.ts"
supersedes: docs/log/2026-11-22-e2-11-invariant-8-races.md
---

**What.** Invariant 8 walks writes, rewrites, retires, promotions, sweeps (a held-back one sometimes repeated at once), adoptions of hand edits and races on two handles over one log; this entry corrects which mutations each test kills.

**Why.** The superseded entry said the trust tests kill the promotion's decision-time refusal; no test did (review E2.11-9).

**Result.** Invariant 8 kills: the promotion and the write commit rechecks removed, the downgrade check, the floor, the write and the sweep eviction filters, adoption's keep, the sweep's shortfall record, and its once-per-state filter (a repeated sweep recorded it again; review E2.11-10). It does not kill the write's or the promotion's decision-time refusal, which the commit recheck repeats with the same rule. `trust.test.ts` kills both: a write's removal fails 22 cases, a promotion's fails the new "refused at the decision" case.

**Consequence.** Every piece of the trust floors is pinned by a named test.
