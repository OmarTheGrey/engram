---
date: 2026-11-23
author: claude-agent
type: decision
card: E8.15e
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/cli/src/tui/line.ts
supersedes: none
---

**What.** Line mode reads with readline at terminal: false, writes each question itself, and a typed command line gets the workspace's flags it does not give.

**Why.** With terminal: false the terminal's own line editing and echo serve the person, which screen readers know, and readline writes nothing; readline's own editing would redraw the line on every backspace. Adding the workspace's flags is what a pasted line does in the full screen's palette.

**Result.** No escape sequence in line mode's output on ConPTY (the smoke checks no alternate screen and no mouse capture).

**Consequence.** Line history (up arrow) is the terminal's, not readline's.
