---
date: 2026-11-22
author: claude-agent
type: failure
card: E8.15a
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/cli/src/run.ts
  - packages/cli/src/commands.ts
supersedes: none
---

**What.** Three merges of main (E1.6, L6, E9.8) conflicted in run.ts, commands.ts, format.ts, mcp.ts and the help snapshot, and the agent was cut off twice by API stalls mid task.

**Why.** Each card edited the old hand-written HELP and command table that this card replaces.

**Result.** Each conflict kept the registry's run.ts and turned the card's command into registry entries (log verify, log checkpoint, supersede, mcp --supersede, export, import); the snapshot was regenerated and differs from main's only by the first line and added lines. Two bash heredoc edits also failed on quoting and were redone as script files. Work was committed and pushed after each step.

**Consequence.** None.
