---
date: 2026-10-25
author: claude-agent
type: decision
card: E2.3
chapter: design
pillar: plane
hypothesis: H1
evidence:
  - packages/core/test/property/invariants.test.ts
  - packages/core/test/property/oracle.ts
  - packages/core/test/unit/oracle.test.ts
  - docs/decisions/0006-scope-owner-grants-typed-policy.md
  - "make test-invariants"
supersedes: docs/log/2026-10-25-e2-2-invariants-on-real-plane.md
---

**What.** The lead-owned invariants change again: the write oracle `writeForbidden(policy, actor, item)` also forbids a write by a non-member of the item's scope and one carrying a grant the gate refuses (decision D4), and invariant 1 reads with query text, on stores with and without search, at instants that collide with grant expiries.

**Why.** Findings R5-2 and R5-11: a mutant admitting everything on the text path, and one comparing expiry with `>=`, survived; the oracle copied the evaluator's pattern match.

**Result.** The oracle now matches patterns and judges grants by its own formulation and compares time through core's helper. Guards require admissions by scope and grant, exclusions by scope and by a grant's terms, and grants expiring exactly at the read time; invariant 2 requires landed and forbidden writes. All four pass; both surviving mutants now fail invariant 1.

**Consequence.** The orchestrator's final review is the second reviewer.
