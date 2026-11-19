---
date: 2026-11-20
author: claude-agent
type: failure
card: E2.6
chapter: evaluation
pillar: plane
hypothesis: none
evidence:
  - packages/core/test/property/invariants.test.ts
  - make test-invariants
supersedes: none
---

**What.** Finding V4-3: the two-handle walk never wrote a derived item, so the lineage mutants survived `make test-invariants`.

**Why.** Derived writes and their races with an erasure were not among its operations.

**Result.** The walk now derives fresh-id role items from person items, adds a short walk of derivations racing an erasure, and checks that no content traced by lineage first lands after its source's erasure. It kills the adoption-time lineage mutant on its own; the decision-time refusal is masked there by the new commit check and is pinned by a unit test through `checkWrite`; the commit-time mutant dies on P8 and P8b and under some walk seeds.

**Consequence.** The lead's second review covers the change to the invariants file.
