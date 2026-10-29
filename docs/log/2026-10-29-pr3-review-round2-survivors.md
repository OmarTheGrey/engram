---
date: 2026-10-29
author: claude-agent
type: change
card: A4
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/adapters/src/files/index.ts
  - packages/adapters/test/files/index.test.ts
  - "pnpm exec vitest run packages/adapters/test/files"
supersedes: none
---

**What.** The three mutants that survived round 2 of the files adapter review are now killed.

**Why.** The lock's release and break code had no test that staged their races, and the title's `toWellFormed` looked redundant.

**Result.** Test seams `lockSeams` (a clock, a hook before breaking, a hook after acquiring; defaults are the wall clock and no-ops) stage both races. A holder whose stale lock was taken leaves the new lock alone, and two waiters breaking one lock leave one holder. `toWellFormed` is needed: YAML writes a lone surrogate in the frontmatter `name` as the escape `\ud800`, which hands it back to Claude Code; only the index line is covered by Node's UTF-8 writer. A test now checks the name. Each mutant fails its test.

**Consequence.** Every mutant of the round-2 code is killed.
