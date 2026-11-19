---
date: 2026-11-19
author: claude-agent
type: change
card: RV3
chapter: implementation
pillar: twin
hypothesis: none
evidence:
  - packages/adapters/src/files/index.ts
  - packages/adapters/test/files/rv3.test.ts
  - packages/adapters/test/plane/rv3-files.test.ts
  - packages/adapters/test/plane/offboard-files.test.ts
supersedes: none
---

**What.** An imported Claude Code memory file's item id is now derived from its folder's identity (real path, without case on Windows) and its file name, `importedItemId(root, key)`, instead of the file name alone (review finding RV-ADP-2).

**Why.** Two members' folders each holding `user_role.md` got one item id, so adoptions into one log retired each other's items on every pass (the reviewer's probe `collide.mts`).

**Result.** Two folders' files of one name are two items; one folder's ids are stable across instances and spellings of its path; through the plane, with two adapter names, both members adopt and read their own item and a second adoption retires neither. Reverting to key-only ids (mutant R2) fails three tests. `offboard-files.test.ts` passes unchanged.

**Consequence.** The ids of imported files change at this card. No dogfood log exists yet, so nothing is migrated (ADR 0013, amendment of card RV3).
