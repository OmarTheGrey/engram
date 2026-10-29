---
date: 2026-10-29
author: claude-agent
type: decision
card: E2.5
chapter: design
pillar: plane
hypothesis: H1
evidence:
  - packages/core/test/property/invariants.test.ts
  - packages/core/test/property/oracle.ts
  - packages/core/test/unit/oracle.test.ts
  - docs/conventions/testing.md
  - "make test-invariants"
supersedes: none
---

**What.** The lead-owned invariants cover promotion: invariant 2 also runs promotions after generated restatement sequences, and invariant 1 also checks the Plane's surface.

**Why.** Plan section 4, PR 5, item 4: a promotion must never land where a write could not (ADR 0026), and MemClaw's get-by-id bypass (2606.24535) was invariant 1 on the wrong path.

**Result.** Restatements by same and different actors, trusted and untrusted kinds, reviews by owners, non-owners and model-sourced actors; a landing must satisfy `promotionPermitted` (oracle-own content normal form) and `writeForbidden`, and be no more trusted than its source. Guards require each refusal kind. Mutating the distinct-actor, trusted-kind, owner or write-evaluation rule fails invariant 2; the k boundary is caught by unit tests only, since the oracle checks soundness. `make test-invariants`: 5 passed.

**Consequence.** Second reviewer: the orchestrator's verification of this branch, then the lead.
