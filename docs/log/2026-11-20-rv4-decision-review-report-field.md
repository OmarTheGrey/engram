---
date: 2026-11-20
author: claude-agent
type: decision
card: RV4
chapter: design
pillar: twin
hypothesis: none
evidence:
  - packages/core/src/plane/offboard.ts
supersedes: none
---

**What.** The deletion report gains `erased.not_found_in_store` (refs and items), and `not_reached` names them; such refs are not listed under `store_refs` (deleted).

**Why.** `left_in_store` says the store refuses the delete and the person deletes there, which is not what happened; `store_refs` means proven deleted. `DeletionReport` is core's TypeScript type, not the schema or the API, so no schema change (rule 5).

**Result.** The test asserts `store_refs` empty and five items under `not_found_in_store`.

**Consequence.** A reader of the report sees the moved folder named. If a consumer compared the whole `erased` object, it gains one field.
