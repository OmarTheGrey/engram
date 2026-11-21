---
date: 2026-11-21
author: claude-agent
type: failure
card: B7
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - "git log -1 refs/rescue/b7-merit-harness-stash"
  - packages/bench/src/merit/launch.ts
supersedes: none
---

**What.** Rebasing onto B10's fix pass with `git stash`, my uncommitted work and card B11's crossed: every worktree shares refs/stash, and each of us popped the other's.

**Why.** `git stash pop` takes the top of a stack all worktrees share.

**Result.** My files appeared in B11's worktree and B11's tau2 files in mine. I moved each back, restored B11's package.json and pnpm-lock.yaml to its HEAD, and checked my commit against the coordinator's rescue ref: the only differences are edits made after the rebase. Nothing was lost.

**Consequence.** No stash: a WIP commit before any rebase.
