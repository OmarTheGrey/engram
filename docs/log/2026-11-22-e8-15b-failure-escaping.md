---
date: 2026-11-22
author: claude-agent
type: failure
card: E8.15b
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/cli/src/tui/app.ts
  - packages/cli/src/tui/layout.ts
supersedes: none
---

**What.** Edits through the shell collapsed doubled backslashes again: one regex reached the source with a raw ESC byte and lost its escapes, which biome and tsc caught.

**Why.** Backslashes passed through the shell before Python read them.

**Result.** Edit scripts are now written with the Write tool; the mouse report is parsed without a regex; a scan finds no control byte in the TUI's sources.

**Consequence.** None in the code.
