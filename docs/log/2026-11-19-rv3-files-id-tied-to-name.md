---
date: 2026-11-19
author: claude-agent
type: change
card: RV3
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/adapters/src/files/index.ts
  - packages/adapters/test/files/rv3.test.ts
  - packages/adapters/test/plane/rv3-files.test.ts
  - "pnpm exec vitest run test/files/rv3.test.ts test/plane/rv3-files.test.ts (in packages/adapters)"
supersedes: none
---

**What.** The files adapter refuses an Engram file whose `engram.id` is not its file name (review finding RV-ADP-1): `list` and `search` skip it with a diagnostic, `read` and `delete` throw `UnreadableItemError`.

**Why.** Before, a copy of `<id>.md` as `copy.md` listed the id twice, three adoptions of the unchanged folder appended six events, and after the owner rewrote the item, adopting the stale copy retired the governed version (the reviewer's probe `forge.mts`, parts 1 and 3).

**Result.** The copy scenario, as tests: one listed item, `copy.md` in `diagnostics()`, three adoptions of the unchanged folder append nothing, and the owner reads version 2 after adoption. The five tests failed on the old code and pass now; removing the check (mutant R1) fails five of them.

**Consequence.** One id names one file in the folder, as in the Letta adapter.
