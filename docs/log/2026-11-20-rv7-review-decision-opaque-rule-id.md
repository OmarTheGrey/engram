---
date: 2026-11-20
author: claude-agent
type: decision
card: RV7
chapter: design
pillar: twin
hypothesis: none
evidence:
  - packages/core/src/policy/evaluate.ts
supersedes: none
---

**What.** The opaque refusals of the two owner rules use the membership rule's id (`engram/write/membership`), not their own.

**Why.** Every event's `policy_id` reaches the writer, so `engram/grant/owner` or `engram/write/move` would say which check failed: that the item carries grants, or that the write moved it. The membership refusal already uses the same opaque words for an id held by an item the writer cannot access.

**Result.** Tests for both cases, run as a role context.

**Consequence.** The older version and owner checks still return the opaque reason under `engram/write/version`. That id names a check too, but less: only that the id is taken. They are left as they were, outside this card.
