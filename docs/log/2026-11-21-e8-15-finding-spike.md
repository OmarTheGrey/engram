---
date: 2026-11-21
author: claude-agent
type: finding
card: E8.15
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - docs/decisions/0044-cli-tui.md
  - "node --test headless.test.ts and node pty.ts direct|bash, in the session scratchpad's tui-spike folder (never committed)"
supersedes: none
---

**What.** A throwaway spike checked pi-tui 1.3.0 on this Windows 11 machine: a box layout, keys, a help overlay, resize, ASCII and no colour, headless and in a real console.

**Why.** ADR 0044 needed evidence that the chosen library works under Git Bash and that a headless test can drive it.

**Result.** Headless, a fake `Terminal` feeding `@xterm/headless` 5.5.0: four tests, 4 pass, 0 fail. Inside a Windows pseudoconsole through `@lydell/node-pty` 1.1.0, directly, under Git Bash's `bash.exe` and in ASCII with `NO_COLOR`: the selection moved, the overlay opened and closed, resizes to 120x40 and 60x20 redrew, `q` exited 0, and the ASCII run wrote no box-drawing character. Piped stdout and stdin refused before any escape sequence. Not checked: mintty without ConPTY, macOS Terminal, tmux.

**Consequence.** Card E8.15e checks the rest by hand.
