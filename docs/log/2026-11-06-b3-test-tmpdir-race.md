---
date: 2026-11-06
author: claude-agent
type: change
card: none
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - packages/runner/test/b3.test.ts
  - "pnpm --filter runner exec vitest run test/b3.test.ts"
supersedes: none
---

**What.** Card B3's runner acceptance test now runs in a temporary folder of its own, so its check that every Letta repository was removed counts only the stores it opened.

**Why.** It listed the `engram-runner-letta-` folders of the system temp folder before and after its run, and other runner test files open Letta stores there at the same time, in their own processes. CI's `check` failed on it for PRs #28, #30, #31 and #33 on 2026-11-06, none of which touches the runner; it had also failed under load on Windows.

**Result.** A test that plants a runner Letta folder in the shared temp folder failed before the change with CI's message and passes after it; a folder left in the file's own temp folder is still counted. The runner suite passes in parallel.

**Consequence.** Rerunning CI on the four PRs, or updating them from main, clears their failure.
