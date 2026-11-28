---
date: 2026-11-28
author: claude-agent
type: decision
card: E2.18
chapter: design
pillar: plane
hypothesis: none
evidence:
  - tools/symcc/properties.ts
  - research/results/h2-cedar-properties.json
supersedes: none
---

**What.** Every check's left set carries one forbid, the domain: requests Engram cannot express are out of every property.

**Why.** The solver ranges over every request the Cedar schema types, including levels, statuses, classes and source kinds Engram does not have, any Long as an instant, and confidences outside [0, 1]. A counterexample there says nothing about Engram and cannot be replayed through its evaluator.

**Result.** The domain keeps the four levels, Engram's statuses, classes and source kinds, instants from 1970 to 9999 with nanoseconds below a billion, versions and ttls from 1 to 2^53 minus 1, and confidences in [0, 1] by their bits. Instants before 1970 are left out, though a timestamp can write them. The domain's text is in the result (`scope.domain`).

**Consequence.** If wrong, a property could fail only for a request outside the domain; widening it is one edit and a rerun.
