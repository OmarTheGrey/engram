---
date: 2026-11-22
author: claude-agent
type: decision
card: E2.11
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/policy/retention.ts
  - packages/core/src/plane/retention.ts
  - "make test-one T=packages/core/test/counterexamples/trust.test.ts"
supersedes: none
---

**What.** A sweep that protect_trusted keeps from evicting the whole overage records the rest as one event: op `evict`, decision `deny`, no item, rule `engram/retention/protected`, once per state per scope and class.

**Why.** The lead's decision on review E2.11-5: a budget left exceeded must not be silent (AGENTS.md rule 3).

**Result.** It follows the sweep's own patterns: a refused sweep is a `deny` with no item (`engram/retention/membership`), and a manual overage is asked once per state. The reason names the overage and the trust option, and no count to a reader who cannot read the scope. A change to an item of the class records it again. With the option off nothing changes (the registered pin holds).

**Consequence.** The dogfood report lists the new rule id.
