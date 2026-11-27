---
date: 2026-11-23
author: claude-agent
type: finding
card: E8.15e
chapter: evaluation
pillar: plane
hypothesis: none
evidence:
  - docs/design/tui-manual-check.md
  - test/e2e/tui.e2e.test.ts
supersedes: none
---

**What.** engram tui was run by hand on a scratch workspace in conhost, Windows Terminal, Git Bash's mintty and tmux 3.4 under WSL, each through Home, Doctor, help or a write, L to line mode and quit; VS Code's terminal and macOS Terminal were not checked (the document says why).

**Why.** Design 11.7 and section 13 ask for each terminal, and whether conhost's ASCII default can go.

**Result.** All four ran every step with exit 0 and the session's commands printed. Windows Terminal answered OSC 11 and showed the dark hues; conhost, mintty through its pseudoconsole, and detached tmux did not answer, so symbols stayed bold with no hue. Three faults found and fixed: actor hidden by a long log path, mintty taken for conhost, the last frame left in the scrollback.

**Consequence.** conhost keeps ASCII status symbols: its ℹ overlaps the next cell.
