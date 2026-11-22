---
date: 2026-11-21
author: claude-agent
type: decision
card: E8.14
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/plane/scopes.ts
supersedes: none
---

**What.** The scope listing is recorded as a `read` event with no item ids and a reason starting `scope list: `, and a scope reached through a grant counts only when the read filter would admit an item there now.

**Why.** Rule 3 needs an event, the op enum has no listing op, and the schema may not change. Judging grants by `evaluateRead` keeps the list to what a read would reveal (decision D5).

**Result.** `readCounts` returns null for it, and utility counts nothing, since it names no item. The twin dogfood report counts it as a read event.

**Consequence.** If wrong, a schema card could add an op; the reason prefix makes these events easy to find.
