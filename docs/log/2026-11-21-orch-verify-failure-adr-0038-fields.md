---
date: 2026-11-21
author: claude-orchestrator
type: failure
card: E1.6
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - docs/decisions/0038-tamper-evident-log-that-keeps-erasure.md
  - packages/core/src/plane/offboard.ts
  - packages/core/src/schema.ts
  - docs/tasks/E1.6.md
supersedes: none
---

**What.** The fix round's ADR 0038 still described the hashed record wrongly; the verification pass found three errors (V-1 to V-3).

**Why.** The fix listed the event's fields from memory again instead of from `packages/core/src/schema.ts` and `packages/core/src/plane/offboard.ts`.

**Result.** It hashed every reason plainly, though offboarding rewrites a lint event's reason, so the first offboarding touching a lint event would have broken verification. Its field list named a `rule` field that does not exist and omitted `id`, `usage`, `item_ids`, `schema_version`, the item's other fields and the removed `session_entry_id`. Its erase-event rule did not cover a lint event about another item. The skeleton is now the whole event with exactly the parts the two redaction functions rewrite as commitments, and each offboarding chains a manifest of what it redacted.

**Consequence.** Card E1.6 has a drift test tying the skeleton to `offboard.ts`.
