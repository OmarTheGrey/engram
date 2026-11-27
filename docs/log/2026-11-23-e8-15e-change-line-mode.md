---
date: 2026-11-23
author: claude-agent
type: change
card: E8.15e
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/cli/src/tui/line.ts
  - packages/cli/test/tui/line.test.ts
  - packages/cli/src/tui/main.ts
supersedes: none
---

**What.** Line mode: the menu of 8.31 in Home's groups, a command by number or name asked one flag a line from its registry entry or typed whole, the CLI's checks asking the named field again, write's check preview, the confirmations of 9.5 in words, mcp and hook as setup with Try it, serve until an empty answer, workspace, help, screen and quit.

**Why.** Card E8.15e; the design's screen-reader mode.

**Result.** line.test.ts was written first and failed on the missing module; it now passes 22 tests, among them the 8.31 transcript compared byte for byte with the plain CLI's own output for the same command line, and a walk of line.ts's imports that finds no pi-tui.

**Consequence.** --line, ENGRAM_TUI_LINE=1, tui.json's line option and TERM=dumb start it; L and screen switch.
