---
date: 2026-10-29
author: claude-agent
type: failure
card: A2
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/adapters/test/letta/repository.test.ts
  - packages/adapters/src/lock.ts
supersedes: none
---

**What.** Three smaller defects (review findings R2-8, R2-11, R2-12): an empty folder inside another repository was initialised as a nested repository though ADR 0028 said it was refused; deleting an item file never committed failed with "pathspec did not match"; the 60 s stale age let a live Letta writer's lock be broken, since a write may take several git calls of up to 60 s each.

**Why.** The open path never asked git whether the folder was inside a repository; the delete always named the item path; the lock's stale age was the files adapter's.

**Result.** Such folders are refused (and a folder created for them removed); a path HEAD lacks and the change removes is left out of the pathspec; `createStoreLock` takes `staleMs`, 300 s for Letta. Tests cover the first two and fail when their fix is reverted.

**Consequence.** None beyond the fixes.
