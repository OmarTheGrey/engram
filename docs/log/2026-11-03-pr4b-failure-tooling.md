---
date: 2026-11-03
author: claude-agent
type: failure
card: R1
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - docs/tasks/prereg-v1-plan.md
supersedes: none
---

**What.** The worktree's shell guard refused several compound commands: a loop feeding `bc`, a timed subshell, a heredoc writing scratch configs, and a command mixing `git` with other steps.

**Why.** The guard refuses what it cannot verify stays inside the worktree.

**Result.** Each was rerun as plain separate commands, files were written with the editor tool, and the per-store timing configs were written as three files; nothing ran outside the worktree and the scratchpad.

**Consequence.** Shell steps stay single and plain in this environment, as part A also found (`docs/log/2026-11-03-pr4a-failure-tooling.md`).
