---
date: 2026-11-13
author: claude-agent
type: failure
card: none
chapter: implementation
pillar: twin
hypothesis: none
evidence:
  - packages/core/test/unit/plane/offboard-edges.test.ts
  - packages/core/src/plane/offboard.ts
supersedes: none
---

**What.** Offboarding's erasure (card E9.7) left an erased item's content hash and provenance hash in the reasons of lint events (card L1).

**Why.** E9.7's redaction rewrote only events that carry an item; L1's lint events carry an item id and put their evidence (a duplicate's strict content hash, a source-changed finding's recorded and current hashes) in `reason`. The deletion report's `not_reached` text and ADR 0010 both promised those hashes were gone.

**Result.** Reproduced under the twin profile: two equal person notes, a lint, an offboarding, and the log still held the hash. Fixed: every lint event about an erased item, or naming one or a hash of one of its versions, keeps its lint id, severity and rule and reads `<lint_id> (<severity>): [erased]`. Replay and rebuild still equal the incremental projection on SQLite and embedded Postgres.

**Consequence.** New evidence in a reason must join the redaction.
