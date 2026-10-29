---
date: 2026-10-29
author: claude-agent
type: failure
card: B4
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - packages/runner/src/mem-inv-probe.ts
supersedes: none
---

**What.** During the fix pass a mutation check restored `mem-inv-probe.ts` with `git checkout`, which also discarded that file's uncommitted fix edits.

**Why.** The fixes were not committed before the mutation, and `git checkout <file>` restores the last commit, not the state before the mutation.

**Result.** The lost edits (the derived kind in the results, the stop-reason mapping, the call change) were found by a zero count of `replyEnding` and made again; the runner tests passed after.

**Consequence.** Mutations are undone by reversing the mutation itself, or run only on a committed tree.
