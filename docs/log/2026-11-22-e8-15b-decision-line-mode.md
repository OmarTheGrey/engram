---
date: 2026-11-22
author: claude-agent
type: decision
card: E8.15b
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/cli/src/tui/main.ts
supersedes: none
---

**What.** `--line` and `ENGRAM_TUI_LINE=1` refuse with exit 2 and a line naming card E8.15e, and `L` says the same, until line mode lands.

**Why.** The flag is E8.15b's, line mode is E8.15e's; the CLI already answers a not-yet-landed card with exit 2 naming it.

**Result.** entry.test.ts holds both refusals.

**Consequence.** E8.15e replaces the refusal; if wrong, a screen-reader user meets a clear refusal rather than a full-screen redraw.
