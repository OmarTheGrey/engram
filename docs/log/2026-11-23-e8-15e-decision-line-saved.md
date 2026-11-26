---
date: 2026-11-23
author: claude-agent
type: decision
card: E8.15e
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/cli/src/tui/screens/workspace.ts
  - packages/cli/src/tui/line.ts
supersedes: none
---

**What.** The workspace panel gains Line mode at start (saved as tui.json's line option); saving the workspace from line mode saves it too; line mode's screen command opens the full screen.

**Why.** Design 11.6 says ENGRAM_TUI_LINE is saved when chosen, but nothing wrote the option; a saved line option with no way back would trap a person in line mode.

**Result.** Workspace frames updated for the toggle; line.test.ts starts line mode from a saved option.

**Consequence.** None.
