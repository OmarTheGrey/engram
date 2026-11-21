---
date: 2026-11-21
author: claude-agent
type: failure
card: B11
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - "git show --stat refs/rescue/b11-tau2-harness-stash"
  - "git show --stat refs/rescue/b7-merit-harness-stash"
supersedes: none
---

**What.** Rebasing onto B10's review fix, this card stashed its untracked work with `git stash -u`, rebased and popped, and got card B7's work instead of its own.

**Why.** `refs/stash` is shared by every worktree of a repository. B7 stashed and popped at the same minute, so each agent popped the other's entry.

**Result.** Nothing was lost: both stash commits were pinned under `refs/rescue/`, B7's files were removed from this worktree and this card's restored from its own stash commit, and the coordinator told B7 how to recover. B7's worktree was not touched.

**Consequence.** No agent uses `git stash`; a work-in-progress commit goes before any rebase.
