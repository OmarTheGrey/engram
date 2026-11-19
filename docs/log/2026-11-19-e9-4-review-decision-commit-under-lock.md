---
date: 2026-11-19
author: claude-agent
type: decision
card: E9.4
chapter: design
pillar: twin
hypothesis: none
evidence:
  - packages/core/src/plane/grants.ts
  - docs/decisions/0034-grant-change-is-the-owners-governed-write.md
supersedes: none
---

**What.** A grant change's event is appended in one transaction holding the log's lock, after reading the item again; a stale decision is one deny event under a rule of its own, `engram/grant/conflict`, and the store is put back.

**Why.** The read path has done the same since PR #41 (`packages/core/src/plane/read.ts`). Comparing the whole projected item, not only its version, also catches an erasure followed by a re-adoption under the same id.

**Result.** Putting the store back runs after the transaction, since adapters are asynchronous: the rewritten record is deleted when the item is gone, the projected item written back otherwise; a failure there is one more deny event under `engram/write/store-failure`, rethrown.

**Consequence.** ADR 0034, decision 5. In-place promotion has the same pattern: a finding and a backlog row.
