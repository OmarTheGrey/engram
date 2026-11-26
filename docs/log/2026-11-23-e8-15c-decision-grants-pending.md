---
date: 2026-11-23
author: claude-agent
type: decision
card: E8.15c
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/cli/src/tui/screens/grants.ts
  - packages/cli/test/tui/parity.test.ts
supersedes: none
---

**What.** Grants holds a pending change: the `--add` and `--remove` the screen was opened with, drafts added with Add to the change, and grants chosen for removal with enter; ctrl+s sends them all in one call, the draft included when typed. Undo inverts the whole change on the item it changed, and editing the item's field clears it.

**Why.** Review findings 4 and 12, and the UX item: the CLI takes several changes in one call, and an opened command line's grants were dropped.

**Result.** Parity case "grants opened with two --add, in one call" equals the plain command in process and against a server. Mutations: dropping the opened grants fails 2 tests; both undo guards removed together fail the flow (each alone survives, being redundant).

**Consequence.** None.
