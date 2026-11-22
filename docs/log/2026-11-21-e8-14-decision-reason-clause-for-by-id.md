---
date: 2026-11-21
author: claude-agent
type: decision
card: E8.14
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/plane/read-reason.ts
supersedes: none
---

**What.** A by-id read is marked by a reason clause, `; read by id <id>`, not by the event's `item_id` or a new op.

**Why.** The schema may not change (rule 5; only card E2.8 changes it), and code elsewhere assumes a read event has a null `item_id`. The clause is optional and comes last, so every older reason parses as before.

**Result.** `parseReadReason` and `readValidAt` are unchanged for existing reasons, and `readByIdTarget` reads the clause. Only the event's maker sees it (visibleEvents), and the maker supplied the id.

**Consequence.** If this is wrong it costs one regex group; a later schema change could move the id into a field.
