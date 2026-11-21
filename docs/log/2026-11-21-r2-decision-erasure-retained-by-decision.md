---
date: 2026-11-21
author: claude-agent
type: decision
card: R2
chapter: design
pillar: twin
hypothesis: none
evidence:
  - packages/core/src/plane/offboard.ts
  - packages/core/test/unit/plane/offboard-edges.test.ts
  - docs/tasks/lead-decisions.md
  - docs/research/preregistration.md
supersedes: docs/log/2026-11-21-r2-decision-erasure-sizes-and-tiers.md
---

**What.** The erasure-residue check (now U7) keeps its sizes and tiers: 200 exposed canaries, 200 controls, the database file's bytes and the MemFS git history. It now reports three traces as retained by decision, never as residue.

**Why.** Offboarding keeps three things by design: promotions made before the offboarding, the strict content hashes of erased versions for a record left in a store or not found there, so adoption refuses that content, and a store ref shared with an item outside the person scope (item 38a). Counting them as residue would call a decided rule a leak.

**Result.** Two tests in `offboard-edges.test.ts` pin the hash and ref cases. The check's own fixture holds one case of each, so a rule change moves a counted number.

**Consequence.** Residue is what survives outside those three.
