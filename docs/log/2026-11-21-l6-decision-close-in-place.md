---
date: 2026-11-21
author: claude-agent
type: decision
card: L6
chapter: design
pillar: plane
hypothesis: none
evidence:
  - docs/tasks/L6.md
  - packages/core/src/supersede.ts
supersedes: none
---

**What.** An accepted close is a new version in place: same id, version plus one, `valid_to` set, status unchanged, `store_ref` cleared. Plane.write sets the provenance from the writer (decision D4).

**Why.** This is ADR 0005's rewrite shape, so the gate's rewrite rules apply unchanged.

**Result.** test/unit/plane/supersede.test.ts: allowed for the owner, denied for a grantee under engram/write/membership.

**Consequence.** See the finding on provenance.
