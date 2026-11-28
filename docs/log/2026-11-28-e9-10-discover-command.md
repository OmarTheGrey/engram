---
date: 2026-11-28
author: claude-agent
type: change
card: E9.10
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/cli/src/discover.ts
  - packages/cli/src/registry.ts
  - packages/cli/src/tui/screens/machine.ts
  - packages/cli/test/doctor-discover.test.ts
supersedes: none
---

**What.** `engram discover [--home] [--project]... [--root]... [--json]`, registered in the command registry (help, form, TUI letter D under Machine), with a hand-made TUI screen that draws its counts, a warning symbol when anything is outside, and its --json as a second count.

**Why.** The card's third step; the addendum wires every command into the TUI.

**Result.** On the fake home with the auto memory folder as `--root`: 10 outside, 2 inside, nine groups (`packages/cli/test/doctor-discover.test.ts`, 7 passed). Parity: the TUI's run and `engram discover` print the same bytes (`packages/cli/test/tui/parity-surfaces.test.ts`). Eight new frame goldens `surface-discover-*`; the Home, help and palette goldens moved by the one new row, on purpose.

**Consequence.** Mutation killed: dropping `node_modules` from the skip list fails three tests.
