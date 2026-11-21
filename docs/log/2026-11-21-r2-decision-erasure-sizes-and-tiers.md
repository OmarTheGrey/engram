---
date: 2026-11-21
author: claude-agent
type: decision
card: R2
chapter: design
pillar: twin
hypothesis: none
evidence:
  - docs/research/preregistration.md
  - docs/readings/litreview/2610.31366-afterdeletebench.md
  - docs/readings/litreview/2606.10062-deployment-time-memorization.md
  - packages/core/src/plane/offboard.ts
supersedes: none
---

**What.** The erasure-residue proposal (P6) uses 20 person scopes of 10 synthetic canaries each, 200 exposed and 200 never written as the matched control. Its search covers the log's database file bytes and the MemFS git history, beside the projection, events, store records and derived items.

**Why.** The source report fixed no size. Two hundred matches AfterDeleteBench's split size. Deleted bytes can survive in SQLite free pages, the write-ahead log, and a git repository's history, none of which the erasure in `offboard.ts` claims to touch, so a check that left them out would overstate erasure.

**Result.** Promotions are reported as retained by decision (lead-decisions item 38a), never as residue.

**Consequence.** The card may well find residue in those tiers on today's erasure. That would be a finding for Twin's claim, not a failure of the check.
