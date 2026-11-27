---
date: 2026-11-23
author: claude-agent
type: decision
card: E8.15c
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/cli/src/tui/screens/read.ts
  - packages/cli/test/tui/flows.test.ts
supersedes: none
---

**What.** A later read with a store folder says, on its own row above the command row, "This read also changes the log, as asked: it sweeps and adopts the store."; the first read, which asked, shows nothing more.

**Why.** Verification N5: the note sat in the command row, squeezing the command, and showed on the first read too.

**Result.** Flow test: the first read's frame has no note, the second has it on the row above the command row. Mutation: the note on the first read fails it.

**Consequence.** None.
