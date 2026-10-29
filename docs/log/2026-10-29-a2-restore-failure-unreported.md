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

**What.** A failed restore after a refused commit was not reported, and the refused item could stay staged (review finding R2-3).

**Why.** The restore's `git reset` and the setup's cleanup ran through the non-throwing runner and their exit codes were ignored.

**Result.** The reset now runs through the checked runner, so a failed reset raises the error naming both the commit failure and the restore failure; a `gitRunner` test seam makes the reset fail in two tests (a write, the setup), which fail when the result is ignored again.

**Consequence.** None beyond the fix.
