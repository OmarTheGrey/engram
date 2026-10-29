---
date: 2026-10-29
author: claude-agent
type: failure
card: B4
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - docs/log/2026-10-29-b4-mem-inv-bench-through-the-plane.md
supersedes: none
---

**What.** Several shell commands of the B4 agent were refused by the worktree guard before running: a heredoc that wrote a Python edit script, an append by heredoc to a TypeScript file, and `git -C .` in a chained command.

**Why.** The agent ran in an isolated worktree whose guard refuses commands it cannot prove stay inside the worktree; compound commands with heredocs and a computed git directory fall outside what it can verify.

**Result.** The edits were redone with the file-editing tools and a script file in the session's scratch directory, and git ran without `-C`; no work was lost.

**Consequence.** Agents in worktrees write files with the editing tools and run git plainly from the worktree, as the agent brief already advises for heredocs.
