---
date: 2026-11-22
author: claude-agent
type: finding
card: E8.15b
chapter: evaluation
pillar: plane
hypothesis: none
evidence:
  - packages/cli/src/tui/keys.ts
  - node scratchpad/rv/alt.py (rv-drive.ts under ConPTY)
supersedes: none
---

**What.** alt+c and alt+p sent inside the Write form's text field, under ConPTY, with four environments: conhost's (no WT_SESSION), Windows Terminal's (WT_SESSION set), VS Code's (TERM_PROGRAM=vscode) and Git Bash's bash.exe.

**Why.** The lead asked whether both reach the TUI in Windows Terminal, conhost, Git Bash and VS Code's terminal.

**Result.** In all four, "copied" and the palette appeared within about 125 ms and the TUI exited 0.

**Consequence.** Windows Terminal and VS Code themselves were not launched: their own keymaps (a user binding of alt+c or alt+p) were not checked, only the bytes through ConPTY.
