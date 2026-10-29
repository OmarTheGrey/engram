---
date: 2026-10-29
author: claude-agent
type: failure
card: B3
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - docs/decisions/0030-gatemem-principals-as-scopes-and-grants.md
supersedes: none
---

**What.** Two shell commands of the coding agent were refused by its worktree guard: a heredoc writing a survey script and a `sed` with a path in a shell variable.

**Why.** The agent ran in an isolated git worktree whose guard refuses commands it cannot prove stay inside the worktree, and a computed path in an option position is one.

**Result.** The survey of GateMem's relationship fields that ADR 0030's context reports was rerun as a script file written with the editor and run with `python -I`; no output was lost.

**Consequence.** Agents in worktrees write scripts as files and pass paths literally, as the brief's pitfalls already advise for heredocs.
