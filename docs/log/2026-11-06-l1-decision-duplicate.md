---
date: 2026-11-06
author: claude-agent
type: decision
card: L1
chapter: design
pillar: plane
hypothesis: none
evidence:
  - docs/decisions/0018-duplicates-without-embeddings.md
  - packages/core/src/lint/det.ts
  - fixtures/faults/duplicate.flag.json
supersedes: none
---

**What.** The exact duplicate lint uses the strict content hash: an active item is flagged when an earlier active item (smaller UUIDv7 id) of the same scope and class has the same `strictContentHash`. Recorded as an amendment to ADR 0018.

**Why.** ADR 0018 left the form to card L1. Treating two items as one when they differ in meaning is the worse error for an advisory lint, so not merging is the safe direction, as for promotion's duplicate check (ADR 0026).

**Result.** The flag fixture differs only in whitespace; the near-miss has the same text in another scope, in another class, and in lower case, none flagged.

**Consequence.** Near-duplicates (MinHash, the `near-duplicate` threshold) stay open for a later card.
