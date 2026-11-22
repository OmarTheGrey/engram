---
date: 2026-11-21
author: claude-agent
type: decision
card: E8.15
chapter: design
pillar: plane
hypothesis: none
evidence:
  - docs/design/tui.md
  - packages/cli/test/commands.test.ts
supersedes: none
---

**What.** The TUI is entered with `engram tui`; bare `engram` keeps printing the help to stderr with exit 2.

**Why.** The bare behaviour is pinned byte for byte by `packages/cli/test/commands.test.ts`, and making one word do two things by TTY detection misleads in tmux, over SSH and in Git Bash's mintty, where Node may see pipes. `engram ui` would collide with the web inspector (`packages/ui`, `make ui`).

**Result.** Section 5 of `docs/design/tui.md`: the entry, its flags, and six refusals (no TTY on stdin or stdout, `CI`, `TERM=dumb`, `--json`, a bad flag), each one stderr line and exit 2, before any escape sequence.

**Consequence.** Opening the TUI on a bare `engram` at a TTY is offered to the lead as section 14, item 1. If wrong, it costs one branch in `run`.
