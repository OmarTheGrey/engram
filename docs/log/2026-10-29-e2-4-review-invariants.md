---
date: 2026-10-29
author: claude-agent
type: decision
card: E2.4
chapter: design
pillar: plane
hypothesis: H1
evidence:
  - packages/core/test/property/invariants.test.ts
  - packages/core/test/property/oracle.ts
  - packages/core/test/unit/oracle.test.ts
  - "make test-invariants"
supersedes: docs/log/2026-10-29-e2-4-invariants-retention.md
---

**What.** The lead-owned invariants change again in the PR 4 review fix pass: invariant 2 retires its item through a retire event and compares content by the oracle's own normal form, and invariant 5 adds reused ids, concurrent batches, adoption steps, sweeps by a user, a session and an outsider under a tightened policy, and checks every sweep against the oracle.

**Why.** Second review of the invariants (finding P4-9), and findings P4-1 to P4-3, P4-6, P4-7 and P4-12 change what the oracle must say.

**Result.** `budgetVictims` never picks the item just written and callers leave expired items out; every write's slot, adoption's included, is checked as contiguous after its write. The guard requires every step kind and outcome. `make test-invariants`: 5 passed.

**Consequence.** Second reviewer: the orchestrator's verification of this branch, then the lead.
