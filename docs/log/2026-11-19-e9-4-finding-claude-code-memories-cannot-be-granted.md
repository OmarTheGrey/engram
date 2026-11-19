---
date: 2026-11-19
author: claude-agent
type: finding
card: E9.4
chapter: limitations
pillar: twin
hypothesis: none
evidence:
  - packages/adapters/test/plane/grants-files.test.ts
  - packages/adapters/src/files/index.ts
supersedes: none
---

**What.** On the files adapter, a memory file Claude Code wrote cannot be granted: the adapter holds it read-only (`ReadOnlyItemError`), so a grant change on it is one deny event under `engram/write/store-failure`.

**Why.** The twin dogfood (card E9.5) runs over the files adapter on each member's Claude Code memory folder, so most of a member's person scope is such files.

**Result.** An item written through Engram (`engram write`, or the pi extension's `memory_write`) in the same folder can be granted, its file carries the grant, and adoption leaves it standing; an imported file refuses, and both the item and the file are unchanged (`packages/adapters/test/plane/grants-files.test.ts`, two tests).

**Consequence.** In E9.5 members grant items written through Engram. Granting Claude Code's own files needs grants held by the plane alone (adoption ignoring them) or a copy of the memory into an Engram item: a follow-up card for the lead (ADR 0034).
