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
supersedes: none
---

**What.** During a rebase the Letta adapter committed onto the detached HEAD, and `git rebase --abort` then dropped the item the plane had recorded as stored (review finding R2-2, critical).

**Why.** The adapter committed to whatever HEAD was, with no check of the repository's state.

**Result.** Write, delete and the setup commit are now refused with `RepositoryBusyError` when HEAD is detached or `rebase-merge/`, `rebase-apply/`, `CHERRY_PICK_HEAD`, `REVERT_HEAD`, `MERGE_HEAD` or `BISECT_LOG` is in the git directory; eight tests in `repository.test.ts` cover the states and fail when the check is removed.

**Consequence.** A plane write during such an operation is a store failure with an event, not a silent loss.
