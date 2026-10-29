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
supersedes: docs/log/2026-10-29-e2-5-invariants-promotion.md
---

**What.** The lead-owned invariants follow review P5: invariant 2's promotion oracle replays the events itself and checks reach, expiry, a widening's source, duplicates, confirmer status, and reviewers who own or authored any version.

**Why.** The oracle copied core's owner rule and the generator always wrote items as their owner, so self-approval through another owner's name was invisible (P5-1, P5-9).

**Result.** The generator now writes items by authors other than their owners and adds ttls, delayed promotions, retired confirmers, restatements in the target, case-only restatements, and team and org contexts. Retired content excludes superseded sources and content an active item holds. Guards require refusals by authorship, expiry, widening source, duplicate and reach. Invariant 1 adds a promoter who is not the owner and cannot read the item. `make test-invariants`: 5 passed.

**Consequence.** Second reviewer: the orchestrator's verification of this branch, then the lead.
