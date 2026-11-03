---
date: 2026-11-03
author: claude-agent
type: failure
card: R1
chapter: limitations
pillar: research
hypothesis: none
evidence:
  - packages/adapters/test/letta/commits.test.ts
  - packages/adapters/test/letta/repository.test.ts
supersedes: none
---

**What.** `make test` on part B's last-polish head failed twice on tests that pass alone: first two Letta adapter tests timed out at 30 seconds and a temporary MemFS folder could not be removed (EPERM); then `packages/runner/test/b3.test.ts` found another session's `engram-runner-letta-*` folder in the shared temporary directory.

**Why.** The CPU stood at 100 percent while part A ran its tests in parallel, and the B3 check reads a directory every worktree shares (`2026-11-02-x1r2-failure-concurrent-letta-folders`); part B changed only Markdown.

**Result.** Alone, the two Letta files passed 36 of 36 and `b3.test.ts` 9 of 9, with two other sessions' folders present in the temporary directory.

**Consequence.** Rerun alone before taking a timeout or a leftover folder for a fault.
