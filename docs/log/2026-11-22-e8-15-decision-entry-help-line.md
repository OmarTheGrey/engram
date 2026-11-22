---
date: 2026-11-22
author: claude-agent
type: decision
card: E8.15
chapter: design
pillar: plane
hypothesis: none
evidence:
  - docs/design/tui.md
  - packages/cli/test/commands.test.ts
supersedes: docs/log/2026-11-21-e8-15-decision-entry.md
---

**What.** The TUI opens only with `engram tui`; bare `engram` keeps printing the help to stderr with exit 2; HELP's first line becomes `engram: the Engram control plane from the command line; engram tui opens the terminal interface`.

**Why.** Decided on 2026-11-22 under the lead's delegation (item 62, call 2). One word doing two things by TTY detection misleads in tmux, over SSH and in Git Bash's mintty; naming the TUI on the help's first line makes it findable from bare `engram` and `--help`.

**Result.** Sections 5.1, 5.3 and 12 of the design: that line is the one change to an existing output, and the help snapshot test is updated by it in E8.15a.

**Consequence.** Supersedes the entry that offered bare `engram` to the lead as an open question.
