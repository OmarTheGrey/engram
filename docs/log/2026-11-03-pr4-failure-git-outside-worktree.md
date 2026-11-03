---
date: 2026-11-03
author: claude-agent
type: failure
card: R1
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - "git merge --ff-only 1de4434"
supersedes: none
---

**What.** The orchestrator asked for the blind readings kit to be committed in part B's worktree, on its branch, from PR 4's head `1de4434`. The agent's harness refused every git command outside the agent's own worktree.

**Why.** The agent runs isolated to its own worktree; the harness checks each git command's target, and part B's worktree is another checkout.

**Result.** The agent fast-forwarded its own branch to `1de4434` (only adding commits) and committed the item there. Part B's branch reaches the same commits by `git merge --ff-only worktree-agent-ad67fcb0fa3d3e2dc` in part B's worktree. `PR.md` in part B's worktree was edited as a file, without git.

**Consequence.** Work for another agent's branch is handed to an agent working in that worktree, or fast-forwarded afterwards.
