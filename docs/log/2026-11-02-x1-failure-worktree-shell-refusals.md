---
date: 2026-11-02
author: claude-agent
type: failure
card: X1
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - docs/log/2026-10-29-b4-failure-worktree-shell-refusals.md
supersedes: none
---

**What.** The worktree's shell guard refused several commands of this PR: a search for upstream data across the disk, a pipeline containing the path `bench/eval`, a heredoc writing five configs, and inline Python run through `uv` with the working directory in a variable.

**Why.** The guard refuses a command it cannot prove stays inside the worktree; a word like `eval` in a path or a computed argument is enough. Card B4 met the same guard.

**Result.** Each was rerun as plain commands: files written with the editor's write tool, Python scripts kept in the session's scratch folder and run with `python -I` on literal paths. No work was lost; the disk-wide search was stopped and the data fetched at the pin instead.

**Consequence.** Agents in worktrees should write files with the write tool and pass literal paths.
